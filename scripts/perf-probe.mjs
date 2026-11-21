// Device probe: loads pages in an emulated phone with throttled CPU + network, scrolls them end to end and reports
// transfer size, LCP, CLS, long tasks and dropped frames. Run: node scripts/perf-probe.mjs [baseUrl] [cpuSlowdown]
// Needs the site served (npm run serve) and Playwright's Chromium.
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';
const CPU = Number(process.argv[3] || 4);
const PAGES = ['/', '/projects/', '/services/', '/services/carpentry/', '/contact/'];
const PROFILES = {
  'low-end Android (Moto G class)': { ...devices['Pixel 5'], viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 },
  'iPhone-size': { ...devices['iPhone 13'] },
};

const browser = await chromium.launch();
for (const [name, dev] of Object.entries(PROFILES)) {
  console.log(`\n== ${name}  (CPU ${CPU}x slower, Slow 4G) ==`);
  for (const url of PAGES) {
    const ctx = await browser.newContext(dev);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    let bytes = 0;
    cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; });
    await page.addInitScript(() => {
      window.__m = { lcp: 0, cls: 0, long: 0, longMs: 0 };
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__m.long++; window.__m.longMs += e.duration; } }).observe({ type: 'longtask', buffered: true });
    });
    await page.goto(BASE + url, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const loadBytes = bytes;
    // scroll end to end in flick-sized steps, recording frame times
    const frames = await page.evaluate(async () => {
      const times = [];
      let last = performance.now(), running = true;
      const tick = (t) => { times.push(t - last); last = t; if (running) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const max = document.documentElement.scrollHeight - innerHeight;
      for (let y = 0; y < max; y += innerHeight * 0.35) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
      running = false;
      return times;
    });
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => window.__m);
    const dropped = frames.filter((f) => f > 33).length;
    const worst = Math.max(...frames);
    console.log(`${url.padEnd(24)} load ${(loadBytes / 1024).toFixed(0).padStart(5)} KB | after scroll ${(bytes / 1024).toFixed(0).padStart(5)} KB | LCP ${m.lcp.toFixed(0).padStart(5)} ms | CLS ${m.cls.toFixed(3)} | long tasks ${String(m.long).padStart(2)} (${m.longMs.toFixed(0)} ms) | frames >33ms: ${dropped}/${frames.length}, worst ${worst.toFixed(0)} ms`);
    await ctx.close();
  }
}
await browser.close();
