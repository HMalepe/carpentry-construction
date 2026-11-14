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

const PAGES = ['/', '/services/', '/services/construction/', '/services/maintenance/', '/services/carpentry/', '/projects/', '/about/', '/tenders/', '/contact/', '/quote/', '/privacy/'];
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
      if (label[l.key]) assert.match(text, new RegExp(`Service: ${label[l.key]}${l.item ? ` › ${l.item}` : ''}\\n`), `${u} ${l.key}`);
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
  await p.goto(BASE + '/about/');
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
  await p.focus('.fab');
  await p.keyboard.press('Enter');
  assert.equal(await p.$eval('#quote-sheet', (d) => d.open), true);
  assert.equal(await p.evaluate(() => !!document.activeElement.closest('#quote-sheet')), true);
  const opts = await p.$$eval('.sheet-opt', (as) => as.map((a) => a.href));
  assert.deepEqual(opts.map((h) => waText(h).split('\n')[1]), ['Service: Construction', 'Service: Maintenance', 'Service: Carpentry']);
  await p.keyboard.press('Escape');
  assert.equal(await p.$eval('#quote-sheet', (d) => d.open), false);
  assert.equal(await p.evaluate(() => document.activeElement.className), 'fab');
  await p.context().close();
});

test('mobile menu: opens, Escape closes and focus returns to the button', async () => {
  const p = await open();
  await p.goto(BASE + '/services/');
  await p.click('.menu summary');
  assert.equal(await p.isVisible('.menu-panel a[href="/tenders/"]'), true);
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
    const p = await open({ viewport, bypassCSP: true });
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
  assert.equal(await p.isVisible('text=Project photos are on their way'), true);
  await p.goto(PROD + '/');
  // Section numbers come from a CSS counter (so removing a block cannot leave a gap): none may be
  // hard-coded, and each must actually render. Visual check: /01, /02, /03 … confirmed by screenshot.
  const eyebrows = await p.$$eval('main .eyebrow .n', (ns) => ns.map((n) => ({ text: n.textContent, w: n.getBoundingClientRect().width })));
  const auto = eyebrows.filter((e) => e.text === '');
  assert.ok(auto.length >= 4, `found ${auto.length} auto-numbered sections`);
  assert.ok(eyebrows.every((e) => !/\/\d/.test(e.text)), 'no hard-coded section numbers');
  assert.ok(auto.every((e) => e.w > 10), 'every counter renders');
  assert.deepEqual(p.problems, []);
  await p.context().close();
});
