// Build-level tests: run the real build script in both modes. Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const build = (env) => spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, env: { ...process.env, VERCEL_ENV: '', ...env }, encoding: 'utf8' });
const CASES = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/cases.json'), 'utf8')).length;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

test('preview build succeeds and reports the launch checklist', () => {
  const r = build({ OUT_DIR: '.tmp-test-preview' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /mode: preview/);
  assert.match(r.stdout, /LAUNCH CHECKLIST/);
  assert.match(r.stdout, /All internal links and assets resolve/);
});

test('production build is blocked while critical details are placeholders', () => {
  const r = build({ STRICT: '1', OUT_DIR: '.tmp-test-blocked', SITE_CONFIG: 'tests/fixtures/placeholders-enforced.config.json' });
  assert.equal(r.status, 1);
  for (const k of ['whatsapp', 'email', 'informationOfficer', 'profilePdf']) assert.match(r.stderr, new RegExp(`- ${k}:`));
});

test('VERCEL_ENV=production triggers the same guard (preview deploys do not)', () => {
  assert.equal(build({ VERCEL_ENV: 'production', OUT_DIR: '.tmp-test-blocked', SITE_CONFIG: 'tests/fixtures/placeholders-enforced.config.json' }).status, 1);
  assert.equal(build({ VERCEL_ENV: 'preview', OUT_DIR: '.tmp-test-preview' }).status, 0);
});

test('production build with the essentials ships zero placeholders, keeps real projects', () => {
  const out = path.join(ROOT, '.tmp-test-prod');
  const r = build({ STRICT: '1', OUT_DIR: '.tmp-test-prod', SITE_CONFIG: 'tests/fixtures/launch-minimum.config.json' });
  assert.equal(r.status, 0, r.stderr);
  const html = walk(out).filter((f) => f.endsWith('.html'));
  assert.equal(html.length, 12 + CASES, '12 static pages + one per case study');
  for (const f of html) {
    const s = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /data-placeholder|PHOTO PENDING|TO CONFIRM|\[Placeholder\]/i, path.relative(out, f));
    assert.doesNotMatch(s, /27XXXXXXXXX/, `${path.relative(out, f)} still links to the placeholder WhatsApp number`);
  }
  const projects = fs.readFileSync(path.join(out, 'projects/index.html'), 'utf8');
  const expected = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/projects.json'), 'utf8')).length;
  assert.equal(new Set(projects.match(/\/assets\/img\/projects\/[\w-]+-sm\.webp/g)).size, expected, `all ${expected} real project photos ship`);
  assert.doesNotMatch(projects, /data-cat="(construction|maintenance)"/, 'empty discipline slots are removed');
  assert.doesNotMatch(projects, /Project photos are on their way/, 'empty-state fallback is not shown when real projects exist');
  assert.doesNotMatch(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), /What clients say/, 'empty testimonials section is removed');
});

test('build refuses to write outside the project', () => {
  const r = build({ OUT_DIR: '..' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Refusing to build/);
});

test('sitemap and robots are generated with absolute URLs', () => {
  const out = path.join(ROOT, '.tmp-test-prod');
  const sm = fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8');
  assert.equal((sm.match(/<loc>https:\/\/example\.co\.za\//g) || []).length, 11 + CASES);
  assert.doesNotMatch(sm, /404/);
  assert.match(fs.readFileSync(path.join(out, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/example\.co\.za\/sitemap\.xml/);
});

test('shared-element names: each data-vt appears at most once per page, and every one has generated CSS', () => {
  const out = path.join(ROOT, '.tmp-test-prod');
  const css = fs.readFileSync(path.join(out, 'assets/css/main.css'), 'utf8');
  const cases = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/cases.json'), 'utf8')).map((c) => c.slug);
  for (const f of walk(out).filter((f) => f.endsWith('.html'))) {
    const names = [...fs.readFileSync(f, 'utf8').matchAll(/data-vt="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(names).size, names.length, `${path.relative(out, f)}: duplicate view-transition names would cancel the transition`);
    for (const n of names) {
      assert.ok(cases.includes(n), `${n} is not a case study`);
      assert.ok(css.includes(`[data-vt="${n}"]{view-transition-name:vt-${n}}`), `${n}: no generated CSS`);
    }
  }
});

test('release-guard override ("warn"): production builds, warns loudly, and still ships zero placeholders or dead links', () => {
  const r = build({ STRICT: '1', OUT_DIR: '.tmp-test-warn', SITE_CONFIG: 'tests/fixtures/warn.config.json' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /RELEASE GUARD OVERRIDDEN/);
  const out = path.join(ROOT, '.tmp-test-warn');
  for (const f of walk(out).filter((f) => f.endsWith('.html'))) {
    const h = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(h, /data-placeholder|TO CONFIRM|PHOTO PENDING|27XXXXXXXXX|href="mailto:"/i, path.relative(out, f));
  }
  assert.match(fs.readFileSync(path.join(out, 'contact/index.html'), 'utf8'), /wa\.me\/27729172803/, 'real WhatsApp number is used');
  assert.doesNotMatch(fs.readFileSync(path.join(out, 'tenders/index.html'), 'utf8'), /malepe-rr-company-profile\.pdf/, 'placeholder PDF is not offered');
});
