// Image sharpness audit: for every image on the main pages, compares the pixels the browser actually loaded with the
// pixels the screen needs (rendered CSS size x device pixel ratio). Run: node scripts/image-audit.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:4173';
const cases = JSON.parse(fs.readFileSync(new URL('../src/data/cases.json', import.meta.url), 'utf8'));
const PAGES = ['/', '/projects/', '/services/', '/services/carpentry/', '/services/construction/', `/projects/${cases[0].slug}/`];
const SCREENS = [
  ['phone 360 @2x', { width: 360, height: 740 }, 2],
  ['iPhone 390 @3x', { width: 390, height: 844 }, 3],
  ['tablet 820 @2x', { width: 820, height: 1180 }, 2],
  ['laptop 1440 @1x', { width: 1440, height: 900 }, 1],
  ['desktop 1920 @1x', { width: 1920, height: 1080 }, 1],
];
const browser = await chromium.launch();
let worst = [];
for (const [name, vp, dpr] of SCREENS) {
  let total = 0, soft = 0;
  for (const url of PAGES) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    await page.goto(BASE + url);
    await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')));
    await page.waitForTimeout(1800);
    const rows = await page.evaluate(() => [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth && i.clientWidth > 40 && i.currentSrc.includes('/assets/img/')).map((i) => {
      // naturalWidth is density-corrected when a srcset is used, so read the real file width from the chosen srcset entry.
      const file = i.currentSrc.split('/').pop(), owner = [...(i.parentElement.tagName === 'PICTURE' ? i.parentElement.querySelectorAll('source') : []), i].find((el) => el.srcset && el.srcset.includes(file)) || i;
      const entries = (owner.srcset || '').split(',').map((e) => e.trim().split(/\s+/)).filter((e) => e[1]);
      const picked = entries.find((e) => i.currentSrc.endsWith(e[0].split('/').pop()));
      const widths = entries.map((e) => parseInt(e[1]));
      const fileW = picked ? parseInt(picked[1]) : i.naturalWidth;
      const aspect = i.naturalWidth / i.naturalHeight;
      const shownW = Math.max(i.clientWidth, i.clientHeight * aspect);   // object-fit: cover fills the box
      return { src: i.currentSrc.split('/').pop(), fileW, widths, css: Math.round(i.clientWidth), needed: Math.round(shownW * devicePixelRatio) };
    }));
    for (const r of rows) {
      total++;
      // soft = loaded file has fewer pixels than needed, AND a larger variant exists in the srcset that was not chosen
      const bigger = r.widths.some((w) => w > r.fileW);
      const ratio = r.fileW / r.needed;
      if (ratio < 0.9 && bigger) { soft++; worst.push({ screen: name, url, ...r, ratio }); }
    }
    await ctx.close();
  }
  console.log(`${name.padEnd(18)} images checked ${String(total).padStart(3)} | softer than the screen needs AND a sharper file existed: ${soft}`);
}
worst.sort((a, b) => a.ratio - b.ratio);
for (const w of worst.slice(0, 12)) console.log(`  ${w.screen} ${w.url} ${w.src}: loaded ${w.fileW}px, screen needs ~${w.needed}px (${Math.round(w.ratio * 100)}%)`);
await browser.close();
