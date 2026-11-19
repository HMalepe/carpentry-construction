// Unit tests for the pure build helpers. Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isPh, esc, waDigits, waMessage, waHref, findElements, applyPlaceholderPolicy, criticalProblems, CATEGORIES, validateProjects, projectCard, projectFilters } from '../scripts/lib.mjs';

const services = JSON.parse(fs.readFileSync(new URL('../src/data/services.json', import.meta.url), 'utf8'));
const BRAND = 'Malepe R&R';

test('isPh recognises placeholders and nothing else', () => {
  for (const v of ['[TO CONFIRM]', ' [x] ', '27XXXXXXXXX', '[+27 XX XXX XXXX]']) assert.equal(isPh(v), true, v);
  for (const v of ['2019', 'info@malepe.co.za', '27821234567', 'A [note] inside', '', undefined, null, 42]) assert.equal(isPh(v), false, String(v));
});

test('esc escapes HTML-significant characters', () => {
  assert.equal(esc('<a href="x">R&R</a>'), '&lt;a href=&quot;x&quot;&gt;R&amp;R&lt;/a&gt;');
});

test('waDigits strips formatting but keeps placeholder X', () => {
  assert.equal(waDigits('+27 82 123 4567'), '27821234567');
  assert.equal(waDigits('27XXXXXXXXX'), '27XXXXXXXXX');
});

test('waMessage: each service names itself, with optional job', () => {
  for (const [key, s] of Object.entries(services)) {
    const m = waMessage(BRAND, services, key);
    assert.match(m, new RegExp(`^Hi ${BRAND}, I'd like a quote\\.\\nService: ${s.label}\\nLocation: \\nDetails: $`));
    assert.match(waMessage(BRAND, services, key, s.items[0].name), new RegExp(`Service: ${s.label} › ${s.items[0].name}`));
  }
});

test('waMessage: general, tender and website-problem messages', () => {
  assert.match(waMessage(BRAND, services, 'general'), /Service: \(Construction \/ Maintenance \/ Carpentry\)/);
  assert.match(waMessage(BRAND, services, 'tender'), /tender \/ RFQ\.\nTender \/ RFQ no\.: /);
  assert.match(waMessage(BRAND, services, 'site'), /problem on your website\.\nPage: /);
});

test('waHref encodes the message safely for wa.me', () => {
  const h = waHref('+27 82 123 4567', 'A & B\nC › D');
  assert.equal(h, 'https://wa.me/27821234567?text=A%20%26%20B%0AC%20%E2%80%BA%20D');
  assert.equal(new URL(h).searchParams.get('text'), 'A & B\nC › D', 'round-trips exactly');
});

test('findElements matches balanced elements, including nested same-tag children', () => {
  const html = '<div a><div data-x><div>in</div><div>in2</div></div><p data-x>p</p></div>';
  const r = findElements(html, /\sdata-x\b/);
  assert.deepEqual(r.map((x) => html.slice(x.start, x.end)), ['<div data-x><div>in</div><div>in2</div></div>', '<p data-x>p</p>']);
  assert.throws(() => findElements('<div data-x><div></div>', /\sdata-x\b/), /Unclosed/);
});

const sample = `<section data-collection="t">
  <figure data-optional data-item><span data-placeholder>[quote]</span></figure>
</section>
<div data-if-empty="t">fallback</div>
<ul>
  <li data-optional>{{real}}</li>
  <li data-optional><span data-placeholder>[x]</span></li>
</ul>`;

test('preview mode keeps placeholders and drops fallbacks', () => {
  const out = applyPlaceholderPolicy(sample, { strict: false });
  assert.match(out, /\[quote\]/);
  assert.match(out, /\[x\]/);
  assert.doesNotMatch(out, /fallback/);
});

test('strict mode strips placeholder blocks, empties collections, keeps fallbacks, leaves real content', () => {
  const out = applyPlaceholderPolicy(sample, { strict: true });
  assert.doesNotMatch(out, /data-placeholder/);
  assert.doesNotMatch(out, /data-collection/);
  assert.match(out, /fallback/);
  assert.match(out, /<li data-optional>\{\{real\}\}<\/li>/);
  assert.doesNotMatch(out, /\n[ \t]+\n/, 'no blank lines with trailing whitespace left behind');
});

test('criticalProblems blocks production until the essentials are real', () => {
  const placeholderCfg = JSON.parse(fs.readFileSync(new URL('./fixtures/placeholders-enforced.config.json', import.meta.url), 'utf8'));
  const keys = criticalProblems(placeholderCfg).map((p) => p.split(':')[0]);
  assert.deepEqual(keys, ['whatsapp', 'email', 'informationOfficer', 'profilePdf']);
  const ok = { whatsapp: '27821234567', email: 'office@malepe.co.za', informationOfficer: 'A. Person', profilePdfIsPlaceholder: false };
  assert.deepEqual(criticalProblems(ok), []);
  assert.equal(criticalProblems({ ...ok, whatsapp: '0821234567' }).length, 1, 'local 0-prefixed number is rejected');
  assert.equal(criticalProblems({ ...ok, email: 'not-an-email' }).length, 1);
});

const sampleProject = { slug: 'oak-kitchen', category: 'kitchens', title: 'Oak & white kitchen', alt: 'Oak-finish kitchen with white tops and island', w: 720, h: 540 };

test('projects.json is valid and every photo exists in both sizes', () => {
  const list = JSON.parse(fs.readFileSync(new URL('../src/data/projects.json', import.meta.url), 'utf8'));
  validateProjects(list);
  for (const p of list)
    for (const size of ['sm', 'lg']) assert.ok(fs.existsSync(new URL(`../src/assets/img/projects/${p.slug}-${size}.webp`, import.meta.url)), `${p.slug}-${size}.webp missing`);
  assert.equal(list.filter((p) => p.featured).length, 3, 'exactly three featured projects for the home page');
});

test('validateProjects rejects bad entries with a clear message', () => {
  assert.throws(() => validateProjects([{ ...sampleProject, category: 'garages' }]), /unknown category "garages"/);
  assert.throws(() => validateProjects([sampleProject, sampleProject]), /duplicate slug/);
  assert.throws(() => validateProjects([{ ...sampleProject, alt: 'kitchen' }]), /alt text too short/);
  assert.throws(() => validateProjects([{ ...sampleProject, slug: 'Bad Slug' }]), /slug must be/);
});

test('projectCard: escaped text, lightbox link, optional placeholder until details are known', () => {
  const card = projectCard(sampleProject, 3);
  assert.match(card, /<h3>Oak &amp; white kitchen<\/h3>/);
  assert.match(card, /href="\/assets\/img\/projects\/oak-kitchen-lg\.webp" data-lightbox/);
  assert.match(card, /src="\/assets\/img\/projects\/oak-kitchen-sm\.webp"[^>]*width="720" height="540" loading="lazy"/);
  assert.match(card, /<p class="mono">Kitchens<\/p>/);
  assert.doesNotMatch(card, /\/\d\d/, 'no numbered labels');
  assert.match(card, /<div data-optional><dt>Details<\/dt><dd><span class="ph-tag" data-placeholder>/);
  const known = projectCard({ ...sampleProject, location: 'Hoedspruit', year: '2025' }, 1);
  assert.match(known, /<dd>Hoedspruit · 2025<\/dd>/);
  assert.doesNotMatch(known, /data-placeholder/);
  assert.doesNotMatch(applyPlaceholderPolicy(card, { strict: true }), /data-placeholder/, 'production strips only the unknown details, keeps the card');
  assert.match(applyPlaceholderPolicy(card, { strict: true }), /oak-kitchen-sm\.webp/);
});

test('projectFilters only offers categories that have projects', () => {
  const f = projectFilters([sampleProject], [{ key: 'construction', label: 'Construction' }]);
  assert.deepEqual([...f.matchAll(/for="f-([a-z-]+)"/g)].map((m) => m[1]), ['all', 'kitchens', 'construction']);
  assert.ok(Object.keys(CATEGORIES).length >= 5);
});
