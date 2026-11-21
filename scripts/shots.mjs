// Screenshots of every page at phone + desktop width (static render, deterministic) plus the home page at a few scroll positions
// with motion on. Used to prove a CSS change did not move a pixel:  node scripts/shots.mjs <outDir> [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.resolve(process.argv[2] || 'shots'); const BASE = process.argv[3] || 'http://localhost:4173';
fs.mkdirSync(OUT, { recursive: true });
const cases = JSON.parse(fs.readFileSync(new URL('../src/data/cases.json', import.meta.url), 'utf8')).map((c) => `/projects/${c.slug}/`);
const PAGES = ['/', '/services/', '/services/construction/', '/services/maintenance/', '/services/carpentry/', '/projects/', ...cases, '/contact/', '/quote/', '/privacy/', '/no-such-page/'];
const b = await chromium.launch();
for (const [w, h, tag] of [[390, 844, 'm'], [1440, 900, 'd']]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const p = await c.newPage();
  for (const u of PAGES) {
    await p.goto(BASE + u); await p.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }));
    await p.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 });
    await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))); await p.waitForTimeout(500);   // decoded, so the shot does not depend on timing
    await p.screenshot({ path: path.join(OUT, `${tag}${u.replace(/\//g, '_') || '_'}.png`), fullPage: true });
  }
  await c.close();
}
// motion mode: pinned scenes and reveals at fixed scroll positions
for (const [w, h, tag] of [[390, 844, 'm'], [1440, 900, 'd']]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  for (const [u, sel] of [['/', '.proc'], ['/services/', '.svc-card']]) {
    await p.goto(BASE + u); await p.waitForTimeout(1200);
    for (const f of [0, 0.4, 0.8]) {
      await p.evaluate(([s, f]) => { const e = document.querySelector(s); scrollTo(0, scrollY + e.getBoundingClientRect().top + (e.offsetHeight - innerHeight) * f); }, [sel, f]);
      await p.waitForTimeout(1500);
      await p.screenshot({ path: path.join(OUT, `motion-${tag}${u.replace(/\//g, '_')}-${f}.png`) });
    }
  }
  await c.close();
}
await b.close();
console.log('captured', fs.readdirSync(OUT).length, 'screenshots in', OUT);
