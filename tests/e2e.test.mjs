// End-to-end tests in a real browser (Chromium via Playwright), against the built site served with
// the production response headers (incl. CSP). Run: npm run test:e2e
// First time on a new machine: npx playwright install chromium
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from '../scripts/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const services = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/services.json'), 'utf8'));

const CASE_PAGES = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/cases.json'), 'utf8')).map((c) => `/projects/${c.slug}/`);
const PAGES = ['/', '/services/', '/services/construction/', '/services/maintenance/', '/services/carpentry/', '/projects/', ...CASE_PAGES, '/contact/', '/quote/', '/privacy/'];
const WIDTHS = [320, 390, 768, 1024, 1440];
let browser, preview, prod, BASE, PROD;

function serve(dir) {
  return new Promise((res) => { const s = createServer(path.join(ROOT, dir)).listen(0, () => res(s)); });
}
function build(env) {
  const r = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, env: { ...process.env, VERCEL_ENV: '', ...env }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

before(async () => {
  build({ OUT_DIR: '.tmp-e2e' });
  build({ OUT_DIR: '.tmp-e2e-prod', STRICT: '1', SITE_CONFIG: 'tests/fixtures/launch-minimum.config.json' });
  preview = await serve('.tmp-e2e');
  prod = await serve('.tmp-e2e-prod');
  BASE = `http://localhost:${preview.address().port}`;
  PROD = `http://localhost:${prod.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); preview?.close(); prod?.close(); });

/** New page that records console errors, page errors and CSP violations. */
async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts });
  const page = await ctx.newPage();
  page.problems = [];
  page.on('console', (m) => m.type() === 'error' && page.problems.push(m.text()));
  page.on('pageerror', (e) => page.problems.push(String(e)));
  return page;
}
const waText = (href) => new URL(href).searchParams.get('text');

test('every page returns 200, unknown URLs return the branded 404', async () => {
  const p = await open();
  for (const u of PAGES) assert.equal((await p.goto(BASE + u)).status(), 200, u);
  const r = await p.goto(BASE + '/no-such-page/');
  assert.equal(r.status(), 404);
  assert.match(await p.textContent('h1'), /Off the/);
  await p.context().close();
});

test('no horizontal overflow and no console/CSP errors at 5 widths', async () => {
  for (const width of WIDTHS) {
    const p = await open({ viewport: { width, height: 900 } });
    for (const u of PAGES) {
      await p.goto(BASE + u);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.equal(over, 0, `${u} overflows by ${over}px at ${width}px`);
    }
    assert.deepEqual(p.problems, [], `console errors at ${width}px`);
    await p.context().close();
  }
});

test('every WhatsApp link targets the configured number with the right pre-filled service', async () => {
  const p = await open();
  const label = Object.fromEntries(Object.entries(services).map(([k, s]) => [k, s.label]));
  let checked = 0;
  for (const u of PAGES) {
    await p.goto(BASE + u);
    const links = await p.$$eval('a[data-wa]', (as) => as.map((a) => ({ key: a.dataset.wa, item: a.dataset.waItem, href: a.href, target: a.target })));
    for (const l of links) {
      const url = new URL(l.href);
      assert.equal(url.origin + url.pathname, `https://wa.me/${cfg.whatsapp}`, `${u} ${l.key}`);
      assert.equal(l.target, '_blank');
      const text = waText(l.href);
      assert.match(text, /^Hi Malepe R&R, /);
      if (label[l.key]) assert.ok(text.includes(`Service: ${label[l.key]}${l.item ? ` › ${l.item}` : ''}\n`), `${u} ${l.key}: ${text}`);
      checked++;
    }
  }
  assert.ok(checked > 60, `only ${checked} WhatsApp links found`);
});

test('quote builder: URL pre-fill, validation, full message, "Other" location', async () => {
  const p = await open();
  await p.goto(BASE + '/quote/');
  await p.click('#qb-send');
  assert.match(await p.textContent('#qb-err'), /Choose a service first/);
  assert.equal(p.context().pages().length, 1, 'WhatsApp must not open without a service');

  await p.goto(BASE + '/quote/?service=carpentry&item=Built-in%20cupboards');
  assert.deepEqual(await p.$$eval('.chips[data-for]', (g) => g.filter((x) => !x.hidden).map((x) => x.dataset.for)), ['Carpentry']);
  await p.check('input[name=location][value=Other]', { force: true });
  assert.equal(await p.isVisible('#loc-other'), true);
  await p.fill('#loc-other', 'Klaserie');
  await p.check('input[name=timing][value="This month"]', { force: true });
  await p.check('input[name=client][value=Municipality]', { force: true });
  await p.fill('#qb-notes', '12 classroom cupboards');
  const text = waText(await p.getAttribute('#qb-send', 'href'));
  assert.equal(text, "Hi Malepe R&R, I'd like a quote.\n\nQUOTE REQUEST\nService: Carpentry › Built-in cupboards\nLocation: Klaserie\nTiming: This month\nClient: Municipality\nDetails: 12 classroom cupboards");
  assert.equal(await p.textContent('[data-out=service]'), 'Carpentry › Built-in cupboards');

  // switching service clears the job from the other service
  await p.check('input[name=service][value=Maintenance]', { force: true });
  assert.match(waText(await p.getAttribute('#qb-send', 'href')), /Service: Maintenance\n/);
  assert.deepEqual(p.problems, []);
  await p.context().close();
});

test('quote builder: message still matches the screen after Back navigation', async () => {
  const p = await open();
  await p.goto(BASE + '/quote/');
  await p.check('input[name=service][value=Construction]', { force: true });
  await p.check('input[name=item][value="Paving & boundary walls"]', { force: true });
  await p.goto(BASE + '/contact/');
  await p.goBack();
  await p.waitForFunction(() => document.querySelector('[data-out=service]').textContent !== '—');
  assert.match(waText(await p.getAttribute('#qb-send', 'href')), /Service: Construction › Paving & boundary walls/);
  await p.context().close();
});

test('quote builder: blocked clipboard shows a recovery message', async () => {
  const p = await open();
  await p.goto(BASE + '/quote/?service=maintenance');
  await p.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('denied')); });
  await p.click('#qb-copy');
  await p.waitForFunction(() => document.querySelector('#qb-err').textContent.length > 0);
  assert.match(await p.textContent('#qb-err'), /blocked copying/);
  await p.context().close();
});

test('service sheet: keyboard open, focus inside, Escape closes and returns focus', async () => {
  const p = await open();
  await p.goto(BASE + '/');
  await p.evaluate(() => scrollTo(0, innerHeight * 2));
  await p.waitForFunction(() => getComputedStyle(document.querySelector('.fab')).visibility === 'visible');
  await p.focus('.fab');
  await p.keyboard.press('Enter');
  assert.equal(await p.$eval('#quote-sheet', (d) => d.open), true);
  assert.equal(await p.evaluate(() => !!document.activeElement.closest('#quote-sheet')), true);
  const opts = await p.$$eval('.sheet-opt', (as) => as.map((a) => a.href));
  assert.deepEqual(opts.map((h) => waText(h).split('\n')[1]), ['Service: Construction', 'Service: Maintenance', 'Service: Carpentry']);
  await p.keyboard.press('Escape');
  assert.equal(await p.$eval('#quote-sheet', (d) => d.open), false);
  assert.equal(await p.evaluate(() => document.activeElement.classList.contains('fab')), true, 'focus returns to the WhatsApp button');
  await p.context().close();
});

test('mobile menu: opens, Escape closes and focus returns to the button', async () => {
  const p = await open();
  await p.goto(BASE + '/services/');
  await p.click('.menu summary');
  assert.equal(await p.isVisible('.menu-panel a[href="/contact/"]'), true);
  await p.keyboard.press('Escape');
  assert.equal(await p.$eval('.menu', (d) => d.open), false);
  assert.equal(await p.evaluate(() => document.activeElement.tagName), 'SUMMARY');
  await p.context().close();
});

test('works without JavaScript: quote links and project filter', async () => {
  const p = await open({ javaScriptEnabled: false });
  await p.goto(BASE + '/');
  assert.match(await p.getAttribute('.head-q', 'href'), /^https:\/\/wa\.me\//);
  await p.goto(BASE + '/projects/');
  await p.click('label[for=f-maintenance]');
  const visible = await p.$$eval('.proj', (ps) => ps.filter((x) => x.offsetParent).map((x) => x.dataset.cat));
  assert.ok(visible.length > 0 && visible.every((c) => c === 'maintenance'));
  await p.context().close();
});

test('accessibility: axe-core finds no violations (mobile + desktop)', async () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    // Audit the final, readable state (reduced motion) rather than elements caught mid fade-in.
    const p = await open({ viewport, bypassCSP: true, reducedMotion: 'reduce' });
    for (const u of [...PAGES, '/no-such-page/']) {
      await p.goto(BASE + u);
      await p.addScriptTag({ content: AXE });
      const v = await p.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map((x) => `${x.id} (${x.nodes.length})`));
      assert.deepEqual(v, [], `${u} @${viewport.width}`);
    }
    await p.context().close();
  }
});

test('SEO basics: unique titles/descriptions, canonical, one h1, valid JSON-LD', async () => {
  const p = await open();
  const titles = new Set(), descs = new Set();
  for (const u of PAGES) {
    await p.goto(BASE + u);
    const r = await p.evaluate(() => ({
      title: document.title,
      desc: document.querySelector('meta[name=description]')?.content,
      canonical: document.querySelector('link[rel=canonical]')?.href,
      h1: document.querySelectorAll('h1').length,
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
    }));
    assert.ok(r.title.length <= 60, `${u} title ${r.title.length} chars`);
    assert.ok(r.desc.length >= 70 && r.desc.length <= 160, `${u} description ${r.desc.length} chars`);
    assert.ok(r.canonical.endsWith(u), `${u} canonical ${r.canonical}`);
    assert.equal(r.h1, 1, u);
    for (const j of r.ld) JSON.parse(j);
    titles.add(r.title); descs.add(r.desc);
  }
  assert.equal(titles.size, PAGES.length, 'titles are unique');
  assert.equal(descs.size, PAGES.length, 'descriptions are unique');
});

test('security headers are served (production parity)', async () => {
  const p = await open();
  const r = await p.goto(BASE + '/');
  const h = r.headers();
  assert.match(h['content-security-policy'], /script-src 'self'/);
  assert.doesNotMatch(h['content-security-policy'], /unsafe-inline/);
  assert.match(h['strict-transport-security'], /max-age=\d+/);
  assert.equal(h['x-frame-options'], 'DENY');
  assert.equal(h['x-content-type-options'], 'nosniff');
  await p.context().close();
});

test('production build: no placeholders on screen, empty states shown, still no errors', async () => {
  const p = await open();
  for (const u of PAGES) {
    await p.goto(PROD + u);
    const body = await p.textContent('body');
    assert.doesNotMatch(body, /PLACEHOLDER|TO CONFIRM|PHOTO PENDING|XXX/i, u);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, u);
  }
  await p.goto(PROD + '/projects/');
  const projects = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/projects.json'), 'utf8'));
  assert.equal(await p.locator('.proj').count(), projects.length, 'only real projects remain');
  for (const dead of ['construction', 'maintenance']) assert.equal(await p.isVisible(`label[for=f-${dead}]`), false, `no dead ${dead} filter`);
  await p.click('label[for=f-kitchens]');
  const kitchens = projects.filter((x) => x.category === 'kitchens').length;
  assert.equal(await p.locator('.proj:visible').count(), kitchens, 'kitchens filter shows exactly the kitchens');
  await p.goto(PROD + '/');
  // Design rule: no numbered-section furniture ("01 / 02 / 03", counters, big numerals). Glyphs carry the sequence instead.
  const nums = await p.$$eval('main .eyebrow .n', (ns) => ns.filter((n) => n.getBoundingClientRect().width > 0).length);
  assert.equal(nums, 0, 'eyebrow counters must not render');
  const numerals = await p.$$eval('main h2, main h3, main .eyebrow, main .lbl', (els) => els.filter((e) => /^\s*\/?0?\d{1,2}\s*(\/|·|$)/.test(e.textContent)).length);
  assert.equal(numerals, 0, 'no leading 01/02/03 numerals on headings or labels');
  assert.ok((await p.locator('main .glyph').count()) >= 4, 'the process is drawn with glyphs');
  assert.deepEqual(p.problems, []);
  await p.context().close();
});

test('project photos: alt text, intrinsic size, lazy loading, all load', async () => {
  const p = await open({ viewport: { width: 1440, height: 900 } });
  for (const u of ['/', '/projects/', '/services/carpentry/']) {
    await p.goto(BASE + u);
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 20)); } });
    await p.evaluate(async () => { for (const i of document.querySelectorAll('main img')) { i.loading = 'eager'; await i.decode().catch(() => {}); } });
    const imgs = await p.$$eval('main img', (is) => is.map((i) => ({ src: i.getAttribute('src'), alt: i.getAttribute('alt'), w: i.getAttribute('width'), h: i.getAttribute('height'), nat: i.naturalWidth, deco: !!i.closest('[aria-hidden="true"], .index-thumb') })));
    assert.ok(imgs.filter((i) => !i.deco).length > 0, u);
    for (const i of imgs) {
      assert.ok(i.alt !== null, `${u} ${i.src} needs an alt attribute`);
      if (!i.deco) assert.ok(i.alt.length > 20, `${u} ${i.src} needs descriptive alt text`);
      assert.ok(+i.w > 0 && +i.h > 0, `${u} ${i.src} needs width/height (no layout shift)`);
      assert.ok(i.nat > 0, `${u} ${i.src} failed to load`);
    }
  }
  await p.context().close();
});

test('project lightbox: opens full photo, Escape closes and returns focus', async () => {
  const p = await open();
  await p.goto(BASE + '/projects/');
  const first = p.locator('a[data-lightbox]').first();
  await first.focus();
  await p.keyboard.press('Enter');
  const box = p.locator('dialog.lb');
  assert.equal(await box.evaluate((d) => d.open), true);
  assert.match(await box.locator('img').getAttribute('src'), /\/assets\/img\/projects\/.+-lg\.webp$/, 'lightbox shows the large version');
  await box.locator('img').evaluate((i) => i.decode());
  assert.ok(await box.locator('img').evaluate((i) => i.naturalWidth > 0), 'large image loads');
  assert.ok((await box.locator('img').getAttribute('alt')).length > 20);
  await p.keyboard.press('Escape');
  assert.equal(await box.evaluate((d) => d.open), false);
  assert.equal(await p.evaluate(() => document.activeElement.hasAttribute('data-lightbox')), true);
  assert.deepEqual(p.problems, []);
  await p.context().close();
});

test('motion mode: every reveal completes after scrolling (no content stuck invisible)', async () => {
  const p = await open({ reducedMotion: 'no-preference' });
  for (const u of ['/', '/projects/', '/services/carpentry/', '/services/maintenance/', CASE_PAGES[0]]) {
    await p.goto(BASE + u);
    assert.equal(await p.evaluate(() => document.documentElement.classList.contains('motion')), true, `${u}: motion layer active`);
    const h = await p.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y <= h; y += 300) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(20); }
    await p.waitForTimeout(1800);
    const stuck = await p.evaluate(() => [...document.querySelectorAll('[data-reveal], .reveal-img, .lines, .draw-in, .stg')]
      .filter((e) => e.offsetParent !== null && !e.classList.contains('in')).map((e) => e.className));
    assert.deepEqual(stuck, [], `${u}: elements never revealed`);
    const clipped = await p.evaluate(() => [...document.querySelectorAll('.reveal-img img')].filter((i) => i.offsetParent && getComputedStyle(i).clipPath !== 'inset(0px)').length);
    assert.equal(clipped, 0, `${u}: images still clipped after reveal`);
  }
  assert.deepEqual(p.problems, []);
  await p.context().close();
});

/* ---------------------------------------------------------------------------------------------
   Motion upgrade (playbooks 01 scroll engine · 02 image motion · 05 transitions)
   --------------------------------------------------------------------------------------------- */
const jump = (p, y) => p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y);
const sceneY = (p, sel, f) => p.evaluate(([sel, f]) => { const el = document.querySelector(sel); return scrollY + el.getBoundingClientRect().top + (el.offsetHeight - innerHeight) * f; }, [sel, f]);
const settle = (p, ms = 350) => p.waitForTimeout(ms);

test('pinned process scene: one scene, four beats; scrubbed route; rewinds when scrolling back', async () => {
  const p = await open({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/');
  assert.equal(await p.evaluate(() => document.documentElement.classList.contains('motion')), true);
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.proc-stick')).position), 'sticky', 'process scene is pinned');
  const seen = [];
  for (const f of [0.04, 0.3, 0.55, 0.92]) {
    await jump(p, await sceneY(p, '.proc', f)); await settle(p);
    const r = await p.evaluate(() => ({ stage: document.querySelector('.proc').dataset.stage, active: [...document.querySelectorAll('.proc .stage')].findIndex((s) => s.classList.contains('is-active')) + 1, dash: parseFloat((getComputedStyle(document.querySelector('.route-draw')).strokeDashoffset.match(/[\d.]+/) || ['0'])[0]) }));
    assert.equal(r.stage, String(r.active), 'the highlighted stage matches the scene beat');
    seen.push(r);
  }
  assert.deepEqual(seen.map((r) => r.stage), ['1', '2', '3', '4']);
  assert.ok(seen.every((r, i) => !i || r.dash < seen[i - 1].dash), 'the route line draws further with every beat');
  assert.ok(seen[3].dash < 0.2, 'the route is (almost) fully drawn at the end');
  await jump(p, await sceneY(p, '.proc', 0.04)); await settle(p);
  assert.equal(await p.evaluate(() => document.querySelector('.proc').dataset.stage), '1', 'scrubbing rewinds');
  assert.deepEqual(p.problems, []);
  await p.context().close();
});

test('pinned process scene on a phone: one beat at a time, no overflow', async () => {
  const p = await open({ viewport: { width: 390, height: 844 } });
  await p.goto(BASE + '/');
  await jump(p, await sceneY(p, '.proc', 0.6)); await settle(p, 900);
  const r = await p.evaluate(() => ({ visible: [...document.querySelectorAll('.proc .stage')].filter((s) => parseFloat(getComputedStyle(s).opacity) > 0.9).length, ov: document.documentElement.scrollWidth - innerWidth }));
  assert.equal(r.visible, 1, 'exactly one stage is shown at a time');
  assert.equal(r.ov, 0);
  await p.context().close();
});

test('sticky stacking cards: Services deals as a deck on desktop and stays plain on phones', async () => {
  const d = await open({ viewport: { width: 1440, height: 900 } });
  await d.goto(BASE + '/services/');
  assert.equal(await d.evaluate(() => getComputedStyle(document.querySelector('.svc-card')).position), 'sticky');
  const ps = [];
  for (const off of [-60, 1900]) { await jump(d, (await d.evaluate(() => scrollY + document.querySelector('.svc-stack').getBoundingClientRect().top)) + off); await settle(d, 500); ps.push(await d.evaluate(() => [...document.querySelectorAll('.svc-card')].map((c) => parseFloat(c.style.getPropertyValue('--p') || '0')))); }
  assert.ok(ps[0][0] < 0.05, 'first card starts uncovered');
  assert.ok(ps[1][0] > 0.95 && ps[1][1] > 0.7, 'earlier cards end up covered (scaled and darkened) by the next');
  await d.context().close();
  const m = await open({ viewport: { width: 390, height: 844 } });
  await m.goto(BASE + '/services/');
  assert.equal(await m.evaluate(() => getComputedStyle(document.querySelector('.svc-card')).position), 'relative', 'no sticky deck on a phone (cards would exceed the screen)');
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  await m.context().close();
});

test('header changes tone over paper sections (and back over graphite)', async () => {
  const p = await open({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/services/construction/'); await settle(p, 500);
  assert.equal(await p.evaluate(() => document.querySelector('.site-head').classList.contains('on-paper')), true, 'a paper hero starts with the paper header');
  await p.goto(BASE + '/');
  await settle(p, 500);
  const paper = () => p.evaluate(() => document.querySelector('.site-head').classList.contains('on-paper'));
  assert.equal(await paper(), true, 'the opening is paper: paper header');
  await jump(p, await p.evaluate(() => scrollY + document.querySelector('.cata').getBoundingClientRect().top + 200)); await settle(p, 500);
  assert.equal(await paper(), false, 'catalogue is graphite: dark header');
  await jump(p, await p.evaluate(() => scrollY + document.querySelector('.proc').getBoundingClientRect().top + 200)); await settle(p, 500);
  assert.equal(await paper(), false, 'the process scene is dark too');
  await jump(p, 0); await settle(p, 500);
  assert.equal(await paper(), true, 'back at the top: paper again');
  await p.context().close();
});

test('catalogue: a rail per category, every tile has a no-JS quote link with the job in the message', async () => {
  const p = await open({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  await p.goto(BASE + '/');
  const cats = await p.$$eval('.cat', (n) => n.map((e) => e.querySelector('h3').textContent));
  assert.deepEqual(cats, ['Kitchens', 'Wardrobes', 'TV units', 'Ceilings', 'Bathrooms']);
  const tiles = await p.locator('.tile').count();
  assert.equal(tiles, JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/projects.json'), 'utf8')).length, 'every project is on a shelf');
  const q = await p.$eval('.tile .tile-q', (a) => a.href);
  const m = waText(q);
  assert.match(m, /^Hi Malepe R&R, I'd like a quote\./);
  assert.match(m, /Service: Carpentry › Kitchen units \(like: Charcoal gloss kitchen with island\)/);
  assert.equal(await p.locator('.pick:visible').count(), 0, 'shortlist buttons only appear once the script runs');
  await p.context().close();
});

test('shortlist composer: pick jobs, the WhatsApp message writes itself, survives reload, can be edited and cleared', async () => {
  const p = await open({ viewport: { width: 390, height: 844 } });
  await p.goto(BASE + '/'); await settle(p, 400);
  assert.equal(await p.locator('.pickbar:visible').count(), 0, 'no bar while the shortlist is empty');
  const picks = p.locator('.pick');
  await picks.nth(0).scrollIntoViewIfNeeded(); await picks.nth(0).click();
  assert.equal(await picks.nth(0).getAttribute('aria-pressed'), 'true');
  const wardrobe = p.locator('#cat-wardrobes ~ .rail .pick, .cat:nth-of-type(2) .pick').first();
  await wardrobe.scrollIntoViewIfNeeded(); await wardrobe.click();
  assert.equal(await p.textContent('[data-pick-count]'), '2');
  assert.equal(await p.locator('.fab:visible').count(), 0, 'the shortlist bar replaces the floating WhatsApp button');
  await p.click('.pickbar-open');
  await p.waitForSelector('#composer[open]');
  await p.fill('#comp-loc', 'Hoedspruit');
  await p.fill('#comp-note', 'Two bedrooms, oak finish');
  const msg = waText(await p.getAttribute('[data-comp-send]', 'href'));
  assert.match(msg, /^Hi Malepe R&R, I'd like a quote\.\nService: Carpentry › Kitchens, Wardrobes\nJobs like these:\n• Charcoal gloss kitchen with island \(Kitchens\)\n• .+ \(Wardrobes\)\nLocation: Hoedspruit\nDetails: Two bedrooms, oak finish$/);
  assert.equal(await p.textContent('[data-comp-preview]'), msg, 'the preview is exactly the message that will be sent');
  await p.click('.comp-x >> nth=0');
  assert.equal(await p.textContent('[data-pick-count]'), '1', 'removing a job updates the count');
  await p.keyboard.press('Escape');
  await p.reload(); await settle(p, 400);
  assert.equal(await p.textContent('[data-pick-count]'), '1', 'the shortlist survives a reload');
  await p.goto(BASE + '/projects/'); await settle(p, 300);
  assert.equal(await p.textContent('[data-pick-count]'), '1', 'and follows you to other pages');
  await p.click('.pickbar-open'); await p.waitForSelector('#composer[open]');
  await p.click('[data-comp-clear]');
  assert.equal(await p.locator('.pickbar:visible').count(), 0, 'cleared');
  assert.deepEqual(p.problems, []);
  await p.context().close();
});

test('lightbox can shortlist the job on screen', async () => {
  const p = await open({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/'); await settle(p, 400);
  await p.locator('.tile-ph').first().scrollIntoViewIfNeeded(); await p.locator('.tile-ph').first().click();
  await p.waitForSelector('.lb[open]');
  await p.click('.lb-pick');
  assert.match(await p.textContent('.lb-pick'), /Shortlisted/);
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('.pick').first().getAttribute('aria-pressed'), 'true', 'the tile shows it too');
  assert.equal(await p.textContent('[data-pick-count]'), '1');
  await p.context().close();
});

test('ripple stagger: gallery items arrive in a wave with bounded delays', async () => {
  const p = await open({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/projects/');
  await jump(p, await p.evaluate(() => scrollY + document.querySelector('.proj-grid').getBoundingClientRect().top - 100)); await settle(p, 300);
  const delays = await p.evaluate(() => [...document.querySelectorAll('.proj.in')].map((e) => parseFloat(e.style.transitionDelay || '0')));
  assert.ok(delays.length >= 3, `${delays.length} items revealed in the first batch`);
  assert.ok(new Set(delays).size >= 3, 'delays differ (a ripple, not a block)');
  assert.ok(Math.max(...delays) <= 560, 'no item waits longer than 0.56 s');
  await p.context().close();
});

test('floating WhatsApp pill steps aside while a big call to action is on screen', async () => {
  const p = await open({ viewport: { width: 390, height: 844 } });
  await p.goto(BASE + '/services/carpentry/');
  await jump(p, await p.evaluate(() => scrollY + document.querySelector('.cta-band').getBoundingClientRect().top - 200)); await settle(p, 700);
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.fab')).visibility), 'hidden');
  await p.context().close();
});

test('page transitions: curtain + shared-element morph (project photo → case-study cover); none under reduced motion', async () => {
  const run = async (reducedMotion) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion });
    await ctx.addInitScript(() => { addEventListener('pagereveal', (e) => { window.__vt = { has: !!e.viewTransition }; if (e.viewTransition) e.viewTransition.ready.then(() => { window.__vt.pseudos = [...new Set(document.getAnimations().map((a) => a.effect && a.effect.pseudoElement).filter(Boolean))]; }).catch(() => { window.__vt.failed = true; }); }); });
    const p = await ctx.newPage(); p.problems = [];
    p.on('console', (m) => m.type() === 'error' && p.problems.push(m.text())); p.on('pageerror', (e) => p.problems.push(String(e)));
    await p.goto(BASE + '/projects/'); await settle(p, 500);
    await p.click('a.feature >> nth=0'); await p.waitForURL('**/projects/charcoal-kitchen/'); await p.waitForTimeout(1300);
    const vt = await p.evaluate(() => window.__vt); const y = await p.evaluate(() => scrollY);
    await ctx.close();
    return { vt, y, problems: p.problems };
  };
  const on = await run('no-preference');
  assert.equal(on.vt.has, true, 'a view transition ran');
  assert.ok(on.vt.pseudos.includes('::view-transition-new(root)'), 'curtain on the page itself');
  assert.ok(on.vt.pseudos.includes('::view-transition-group(vt-charcoal-kitchen)'), 'the clicked photograph morphs into the cover');
  assert.equal(on.y, 0, 'new page starts at the top');
  assert.deepEqual(on.problems, []);
  const off = await run('reduce');
  assert.equal(off.vt.has, false, 'reduced motion: plain navigation');
  assert.deepEqual(off.problems, []);
});

test('reduced motion: nothing is pinned, hidden or animated; every scene reads as a plain page', async () => {
  const p = await open({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await p.goto(BASE + '/');
  assert.equal(await p.evaluate(() => document.documentElement.classList.contains('motion')), false);
  const r = await p.evaluate(() => ({
    procH: document.querySelector('.proc').offsetHeight, vh: innerHeight,
    stages: [...document.querySelectorAll('.proc .stage')].map((s) => getComputedStyle(s).opacity),
    sticky: getComputedStyle(document.querySelector('.proc-stick')).position,
  }));
  assert.ok(r.procH < r.vh * 2, `the process scene is not stretched into scroll distance (${r.procH})`);
  assert.deepEqual(r.stages, ['1', '1', '1', '1'], 'all four process steps fully visible');
  assert.equal(r.sticky, 'static');
  await p.goto(BASE + '/services/');
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.svc-card')).position), 'relative');
  await p.context().close();
});

test('no JavaScript: process steps and services are all present and readable', async () => {
  const p = await open({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  await p.goto(BASE + '/');
  const r = await p.evaluate(() => ({ stages: [...document.querySelectorAll('.proc .stage')].map((s) => getComputedStyle(s).opacity), route: getComputedStyle(document.querySelector('.route')).display }));
  assert.deepEqual(r.stages, ['1', '1', '1', '1']);
  assert.equal(r.route, 'none', 'the scroll-drawn route only appears when it can be drawn');
  await p.context().close();
});

test('accessibility: axe-core is clean in mid-animation states too (pinned scenes, motion on)', async () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const p = await open({ viewport, bypassCSP: true });
    await p.goto(BASE + '/'); await settle(p, 1200);
    for (const [sel, f] of [['.proc', 0.05], ['.proc', 0.3], ['.proc', 0.9]]) {
      await jump(p, await sceneY(p, sel, f)); await settle(p, 1200);
      await p.addScriptTag({ content: AXE });
      const v = await p.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map((x) => `${x.id} (${x.nodes.length})`));
      assert.deepEqual(v, [], `${sel} @${f} ${viewport.width}px`);
    }
    await p.context().close();
  }
});

test('low-end devices (<=2 GB RAM or Save-Data) get the plain page: no pinned scenes, everything readable, no overflow', async () => {
  for (const hint of ['deviceMemory', 'saveData']) {
    const p = await open({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
    await p.addInitScript((h) => {
      if (h === 'deviceMemory') Object.defineProperty(navigator, 'deviceMemory', { get: () => 1 });
      else Object.defineProperty(navigator, 'connection', { get: () => ({ saveData: true, effectiveType: '4g' }) });
    }, hint);
    await p.goto(BASE + '/'); await settle(p, 600);
    const r = await p.evaluate(() => ({
      lite: document.documentElement.classList.contains('lite'), motion: document.documentElement.classList.contains('motion'),
      procH: document.querySelector('.proc').offsetHeight, vh: innerHeight, sticky: getComputedStyle(document.querySelector('.proc-stick')).position,
      stages: [...document.querySelectorAll('.proc .stage')].map((x) => getComputedStyle(x).opacity), overflow: document.documentElement.scrollWidth - innerWidth,
      blur: getComputedStyle(document.querySelector('.site-head')).backdropFilter,
    }));
    assert.equal(r.lite, true, hint); assert.equal(r.motion, false, `${hint}: no scroll-driven motion`);
    assert.ok(r.procH < r.vh * 2.6, `${hint}: the process is a plain list, not a pinned scene (${r.procH}px)`);
    assert.equal(r.sticky, 'static'); assert.deepEqual(r.stages, ['1', '1', '1', '1'], `${hint}: every step readable`);
    assert.equal(r.overflow, 0); assert.ok(r.blur === 'none' || r.blur === '', `${hint}: no backdrop blur (${r.blur})`);
    assert.deepEqual(p.problems, []);
    await p.context().close();
  }
});

test('images stay HD: on phones, iPads and desktops the browser loads a file at least ~90% as sharp as the screen needs', async () => {
  const SCREENS = [['360@2x', 360, 740, 2], ['390@3x', 390, 844, 3], ['820@2x', 820, 1180, 2], ['1440@1x', 1440, 900, 1], ['1920@1x', 1920, 1080, 1]];
  for (const [name, width, height, dpr] of SCREENS) {
    for (const url of ['/', '/projects/', '/services/carpentry/', CASE_PAGES[0]]) {
      const p = await open({ viewport: { width, height }, deviceScaleFactor: dpr });
      await p.goto(BASE + url);
      await p.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }));
      await p.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 });
      const soft = await p.evaluate(() => [...document.images].filter((i) => i.clientWidth > 40 && i.currentSrc.includes('/assets/img/')).flatMap((i) => {
        // naturalWidth is density-corrected under srcset, so take the real file width from the chosen srcset entry
        const entries = i.srcset.split(',').map((e) => e.trim().split(/\s+/)).filter((e) => e[1]);
        const picked = entries.find((e) => i.currentSrc.endsWith(e[0].split('/').pop()));
        const fileW = picked ? parseInt(picked[1]) : i.naturalWidth;
        const needed = Math.max(i.clientWidth, i.clientHeight * (i.naturalWidth / i.naturalHeight)) * devicePixelRatio;
        const sharperExists = entries.some((e) => parseInt(e[1]) > fileW);
        return sharperExists && fileW / needed < 0.9 ? [`${i.currentSrc.split('/').pop()} ${fileW}px < ${Math.round(needed)}px`] : [];
      }));
      assert.deepEqual(soft, [], `${name} ${url}`);
      await p.context().close();
    }
  }
});

test('catalogue rails: arrows appear on desktop, scroll the rail, and a rail that starts offscreen still measures itself', async () => {
  const p = await open({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/'); await settle(p, 500);
  const last = p.locator('.cat').last();
  await last.scrollIntoViewIfNeeded(); await settle(p, 400);
  const first = p.locator('.cat').first();
  await first.scrollIntoViewIfNeeded(); await settle(p, 400);
  assert.equal(await first.locator('.rail-ctl').isVisible(), true, 'kitchens rail overflows, so it has arrows');
  const before = await first.locator('.rail').evaluate((r) => r.scrollLeft);
  await first.locator('[data-rail="1"]').click(); await settle(p, 900);
  assert.ok((await first.locator('.rail').evaluate((r) => r.scrollLeft)) > before + 200, 'arrow scrolls the rail');
  assert.equal(await first.locator('[data-rail="-1"]').isDisabled(), false, 'back arrow enables after scrolling');
  assert.deepEqual(p.problems, []);
  await p.context().close();
});

test('catalogue rails are real scroll containers on phones (every job is reachable by swiping), without the page scrolling sideways', async () => {
  const p = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await p.goto(BASE + '/'); await settle(p, 500);
  const r = [];
  for (const rail of await p.locator('.rail').all()) {   // rails below the fold are not laid out until they near the screen (content-visibility)
    await rail.scrollIntoViewIfNeeded(); await settle(p, 250);
    r.push(await rail.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, n: el.children.length })));
  }
  for (const x of r) { assert.equal(x.cw <= 390, true, `rail is no wider than the screen (${x.cw})`); if (x.n > 2) assert.ok(x.sw > x.cw * 1.5, `rail with ${x.n} jobs scrolls sideways (${x.sw} > ${x.cw})`); }
  await p.locator('.rail').first().evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await settle(p, 400);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'the page itself never scrolls sideways');
  assert.equal(await p.evaluate(() => scrollX), 0);
  await p.context().close();
});
