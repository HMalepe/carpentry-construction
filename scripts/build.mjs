// Malepe R&R site builder — zero dependencies. Run: node scripts/build.mjs
// src/pages/**.html  →  dist/**.html, wrapped in src/layout.html with shared header/footer.
// Business details live in site.config.json; service lists live in src/data/services.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isPh, esc, get, waDigits, waMessage as msg, waHref as href, applyPlaceholderPolicy, criticalProblems } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.resolve(ROOT, process.env.OUT_DIR || 'dist');
const read = (p) => fs.readFileSync(p, 'utf8');
if (OUT === ROOT || OUT === SRC || !OUT.startsWith(ROOT + path.sep)) throw new Error(`Refusing to build into ${OUT}`);

const cfg = JSON.parse(read(path.resolve(ROOT, process.env.SITE_CONFIG || 'site.config.json')));
const services = JSON.parse(read(path.join(SRC, 'data', 'services.json')));

// STRICT = production. Vercel sets VERCEL_ENV=production only for production deployments, so
// preview deployments keep showing placeholders while production refuses to ship them.
const STRICT = process.env.STRICT === '1' || process.env.VERCEL_ENV === 'production';
if (STRICT) {
  const problems = criticalProblems(cfg);
  if (problems.length) {
    console.error(`✖ Production build blocked. Fix these in site.config.json first:\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
}

const siteUrl = (
  cfg.siteUrl ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
  'http://localhost:3000'
).replace(/\/$/, '');

const year = new Date().getFullYear();
const waNumber = waDigits(cfg.whatsapp);
const phoneDigits = isPh(cfg.phone) ? waNumber : String(cfg.phone).replace(/[^\d]/g, '');
const telHref = `tel:+${phoneDigits}`;
const mailHref = isPh(cfg.email) ? 'mailto:' : `mailto:${cfg.email}`;

/* ---------- WhatsApp messages (format lives in lib.mjs) ---------- */
const waHref = (serviceKey, item) => href(waNumber, msg(cfg.shortName, services, serviceKey, item));

/* ---------- icons ---------- */
const icon = {
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg>',
  image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/></svg>',
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6z"/><path d="M9.2 8.6c.3-.6.8-.6 1-.2l.7 1.5c.1.3 0 .6-.2.8l-.4.4c.5 1.1 1.4 2 2.5 2.5l.4-.4c.2-.2.5-.3.8-.2l1.5.7c.4.2.4.7-.2 1-1 .6-2.3.6-3.6-.2a8 8 0 0 1-2.7-2.7c-.8-1.3-.8-2.6-.2-3.6z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
};

/* ---------- shared chrome ---------- */
const NAV = [
  { key: 'home', href: '/', label: 'Overview' },
  { key: 'services', href: '/services/', label: 'Services' },
  { key: 'projects', href: '/projects/', label: 'Projects' },
  { key: 'about', href: '/about/', label: 'About' },
  { key: 'tenders', href: '/tenders/', label: 'Compliance', long: 'Tenders & Compliance' },
  { key: 'contact', href: '/contact/', label: 'Contact' },
];
const cur = (meta, key) => (meta.nav === key ? ' aria-current="page"' : '');

function header(meta) {
  const links = NAV.map((n) => `<a href="${n.href}"${cur(meta, n.key)}>${n.label}</a>`).join('');
  const menuLinks = [...NAV, { key: 'quote', href: '/quote/', long: 'Quote request builder' }]
    .map((n, i) => `<a href="${n.href}"${cur(meta, n.key)}><span class="mono">/${String(i + 1).padStart(2, '0')}</span>${esc(n.long || n.label)}</a>`)
    .join('');
  return `<header class="site-head">
  <div class="head-in">
    <a class="logo" href="/" aria-label="${esc(cfg.shortName)} — home"><span class="logo-m" aria-hidden="true">MR</span><span class="logo-t">Malepe R&amp;R</span><span class="mono logo-s">(PTY) LTD</span></a>
    <nav class="nav-d" aria-label="Main">${links}</nav>
    <a class="btn btn-sm head-q" data-wa="general">Get a Quote <span aria-hidden="true">↗</span></a>
    <details class="menu">
      <summary aria-label="Open menu"><span class="i-open">${icon.menu}</span><span class="i-close">${icon.close}</span></summary>
      <div class="menu-panel">
        <nav aria-label="Mobile">${menuLinks}</nav>
        <a class="btn btn-lg btn-block" data-wa="general">Get a Quote on WhatsApp <span aria-hidden="true">↗</span></a>
        <p class="mono menu-foot">${esc(cfg.locality)} · ${esc(cfg.region)} · Maruleng &amp; surrounds</p>
      </div>
    </details>
  </div>
</header>`;
}

function tabbar(meta) {
  const t = [
    { key: 'home', href: '/', label: 'Home', i: icon.home },
    { key: 'services', href: '/services/', label: 'Services', i: icon.grid },
    { key: 'projects', href: '/projects/', label: 'Projects', i: icon.image },
    { key: 'quote', href: '/quote/', label: 'Quote', i: icon.chat, cls: ' tab-q' },
  ];
  return `<nav class="tabbar" aria-label="Quick">${t
    .map((x) => `<a class="tab${x.cls || ''}" href="${x.href}"${cur(meta, x.key)}>${x.i}<span>${x.label}</span></a>`)
    .join('')}<a class="fab" data-wa="general" aria-label="Get a quote on WhatsApp">${icon.wa}</a></nav>`;
}

function sheet() {
  const opts = Object.entries(services)
    .map(([k, s]) => `<a class="sheet-opt" data-wa="${k}"><span class="mono">/${s.num}</span><span><b>${esc(s.label)}</b><small>${esc(s.short)}</small></span><span class="ar" aria-hidden="true">↗</span></a>`)
    .join('');
  return `<dialog class="sheet" id="quote-sheet" aria-labelledby="sheet-t">
  <div class="sheet-in">
    <div class="sheet-head"><span class="mono">GET A QUOTE · WHATSAPP</span><button class="sheet-x" type="button" data-close aria-label="Close">${icon.close}</button></div>
    <h2 id="sheet-t">What do you need?</h2>
    <div class="sheet-opts">${opts}</div>
    <a class="sheet-more" href="/quote/">Build a detailed request (location, timing, client type) <span aria-hidden="true">→</span></a>
    <p class="sheet-alt">No WhatsApp on this device? <a href="/contact/">Call or email us instead</a>.</p>
  </div>
</dialog>`;
}

function footer(meta) {
  const svcLinks = Object.values(services).map((s) => `<li><a href="${s.path}">${esc(s.label)}</a></li>`).join('');
  return `<footer class="site-foot">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="logo" href="/"><span class="logo-m" aria-hidden="true">MR</span><span class="logo-t">Malepe R&amp;R</span><span class="mono logo-s">(PTY) LTD</span></a>
        <p>Building construction, maintenance and carpentry for government departments, municipalities and private clients in ${esc(cfg.locality)}, Maruleng and surrounds.</p>
      </div>
      <div><p class="mono">Services</p><ul>${svcLinks}<li><a href="/quote/">Quote request</a></li></ul></div>
      <div><p class="mono">Company</p><ul><li><a href="/projects/">Projects</a></li><li><a href="/about/">About</a></li><li><a href="/tenders/">Tenders &amp; Compliance</a></li><li><a href="/contact/">Contact</a></li><li><a href="/privacy/">Privacy (POPIA)</a></li></ul></div>
      <div><p class="mono">Contact</p><ul>
        <li><a data-wa="general">WhatsApp: +{{waNumber}}</a></li>
        <li data-optional>Tel: {{cfg.phone}}</li>
        <li>Email: {{cfg.email}}</li>
        <li data-optional>{{cfg.hours}}</li>
        <li data-optional>{{cfg.address}}</li>
        <li><a data-wa="site">Report a website problem</a></li>
      </ul></div>
    </div>
    <div class="titleblock">
      <div><span class="mono">Drawn by</span>${esc(cfg.name)}</div>
      <div><span class="mono">Sheet</span>${esc(meta.title.split('|')[0].trim())}</div>
      <div><span class="mono">Dwg no.</span>${esc(meta.dwg || 'MRR-000')}</div>
      <div><span class="mono">Scale · Rev</span>1:100 · A</div>
      <div><span class="mono">©</span>${year}</div>
    </div>
  </div>
</footer>`;
}

/* ---------- service list renderers ---------- */
function scopeList(key) {
  const s = services[key];
  return `<ol class="scope">${s.items
    .map((it, i) => `<li><span class="mono n">${s.num}.${String(i + 1).padStart(2, '0')}</span><div><h3>${esc(it.name)}</h3><p>${esc(it.desc)}</p></div><a class="scope-q" data-wa="${key}" data-wa-item="${esc(it.name)}" aria-label="Get a quote for ${esc(it.name)} on WhatsApp">Quote <span aria-hidden="true">↗</span></a></li>`)
    .join('')}</ol>`;
}
function itemChips(key) {
  const s = services[key];
  const chips = [...s.items.map((i) => i.name), 'Something else']
    .map((n) => `<label class="chip"><input type="radio" name="item" value="${esc(n)}"><span>${esc(n)}</span></label>`)
    .join('');
  return `<div class="chips" data-for="${esc(s.label)}"><p class="mono chips-t">${esc(s.label)}</p>${chips}</div>`;
}

/* ---------- JSON-LD ---------- */
function businessLD() {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'GeneralContractor',
    '@id': `${siteUrl}/#business`,
    name: cfg.name,
    alternateName: cfg.shortName,
    url: `${siteUrl}/`,
    image: `${siteUrl}/assets/img/og-default.png`,
    logo: `${siteUrl}/assets/apple-touch-icon.png`,
    description:
      'Construction, maintenance and carpentry company in Hoedspruit, Maruleng (Limpopo), serving government departments, municipalities and private clients.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: cfg.locality,
      addressRegion: cfg.region,
      addressCountry: 'ZA',
      ...(isPh(cfg.address) ? {} : { streetAddress: cfg.address }),
    },
    areaServed: cfg.areaServed.map((n) => ({ '@type': 'Place', name: `${n}, South Africa` })),
    knowsAbout: ['Building construction', 'Building maintenance', 'Carpentry', 'Roof trusses', 'Built-in cupboards', 'Public facility maintenance'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Construction, maintenance and carpentry services',
      itemListElement: Object.values(services).map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.label, url: `${siteUrl}${s.path}` },
      })),
    },
  };
  if (!isPh(cfg.phone)) ld.telephone = cfg.phone;
  else if (!isPh(cfg.whatsapp)) ld.telephone = `+${waNumber}`;
  if (!isPh(cfg.email)) ld.email = cfg.email;
  if (!isPh(cfg.regYear)) ld.foundingDate = cfg.regYear;
  return ld;
}
function serviceLD(key) {
  const s = services[key];
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${s.label} services in ${cfg.locality}`,
    serviceType: s.label,
    url: `${siteUrl}${s.path}`,
    provider: { '@id': `${siteUrl}/#business` },
    areaServed: cfg.areaServed.map((n) => ({ '@type': 'Place', name: `${n}, South Africa` })),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: s.label,
      itemListElement: s.items.map((i) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: i.name, description: i.desc } })),
    },
  };
}
function faqLD(html) {
  const qs = [...html.matchAll(/<details class="faq"[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)];
  if (!qs.length) return null;
  const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\{\{[^}]+\}\}/g, '').replace(/\s+/g, ' ').trim();
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qs.filter((m) => !m[2].includes('data-placeholder')).map((m) => ({ '@type': 'Question', name: strip(m[1]), acceptedAnswer: { '@type': 'Answer', text: strip(m[2]) } })),
  };
}

/* ---------- page discovery ---------- */
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith('.html') ? [p] : [];
  });
}
const pagesDir = path.join(SRC, 'pages');
const pages = walk(pagesDir).map((file) => {
  const rel = path.relative(pagesDir, file).split(path.sep).join('/');
  const raw = read(file);
  const m = raw.match(/^<!--meta\s*([\s\S]*?)-->/);
  if (!m) throw new Error(`Missing <!--meta {...} --> block in ${rel}`);
  const meta = JSON.parse(m[1]);
  const url = rel === 'index.html' ? '/' : rel.endsWith('/index.html') ? `/${rel.slice(0, -10)}` : `/${rel}`;
  return { rel, url, meta, body: raw.slice(m[0].length) };
});
const byUrl = Object.fromEntries(pages.map((p) => [p.url, p]));

function breadcrumbLD(page) {
  const parts = page.url.split('/').filter(Boolean);
  const items = [{ name: 'Home', url: '/' }];
  let acc = '/';
  for (const part of parts) {
    acc += `${part}/`;
    const p = byUrl[acc];
    if (p) items.push({ name: p.meta.crumb || p.meta.title, url: acc });
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${siteUrl}${it.url}` })),
  };
}

/* ---------- asset hashing ---------- */
function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    e.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b);
  }
}
const hash = (p) => crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 10);

/* ---------- transforms ---------- */
const partials = Object.fromEntries(
  fs.readdirSync(path.join(SRC, 'partials')).map((f) => [f.replace(/\.html$/, ''), read(path.join(SRC, 'partials', f))]),
);

function applyTokens(html) {
  html = html.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, n) => {
    if (!(n in partials)) throw new Error(`Unknown partial: ${n}`);
    return partials[n];
  });
  html = html.replace(/\{\{svc:(\w+):(scope|chips)\}\}/g, (_, k, kind) => {
    if (!services[k]) throw new Error(`Unknown service: ${k}`);
    return kind === 'scope' ? scopeList(k) : itemChips(k);
  });
  html = html.replace(/\{\{cfg\.([\w.]+)\}\}/g, (_, k) => {
    const v = get(cfg, k);
    if (v === undefined) throw new Error(`Unknown config key: ${k}`);
    if (isPh(v)) return `<span class="ph-tag" data-placeholder>${esc(v)}</span>`;
    return k === 'phone' ? esc(v).replace(/ /g, '&nbsp;') : esc(v);
  });
  html = html.replace(/\{\{attr\.([\w.]+)\}\}/g, (_, k) => esc(get(cfg, k)));
  const simple = {
    waNumber, telHref, mailHref, year, siteUrl,
    mailTo: isPh(cfg.email) ? '' : esc(cfg.email),
    areaInline: esc(cfg.areaServed.join(' · ')),
    areaChips: cfg.areaServed.map((a) => `<li>${esc(a)}</li>`).join(''),
    locChips: [...cfg.areaServed, 'Other']
      .map((a) => `<label class="chip"><input type="radio" name="location" value="${esc(a)}"><span>${esc(a)}</span></label>`)
      .join(''),
  };
  html = html.replace(/\{\{(\w+)\}\}/g, (all, k) => (k in simple ? String(simple[k]) : all));
  // Every <a data-wa="service" [data-wa-item="…"]> becomes a real wa.me link (works without JavaScript).
  html = html.replace(/<a\b([^>]*\bdata-wa="([^"]*)"[^>]*)>/g, (_, attrs, key) => {
    const item = (attrs.match(/\bdata-wa-item="([^"]*)"/) || [])[1];
    const decoded = item ? item.replace(/&amp;/g, '&').replace(/&quot;/g, '"') : undefined;
    const clean = attrs.replace(/\s(href|target|rel)="[^"]*"/g, '');
    return `<a${clean} href="${esc(waHref(key, decoded))}" target="_blank" rel="noopener">`;
  });
  html = html.replace(/<!--(?!\[if)[\s\S]*?-->\n?/g, ''); // drop source comments from output
  const left = html.match(/\{\{[^}]+\}\}/);
  if (left) throw new Error(`Unresolved token: ${left[0]}`);
  return html;
}

/* ---------- build ---------- */
rmrf(OUT);
copyDir(path.join(SRC, 'assets'), path.join(OUT, 'assets'));
const v = { css: hash(path.join(SRC, 'assets/css/main.css')), js: hash(path.join(SRC, 'assets/js/main.js')) };
const layout = read(path.join(SRC, 'layout.html'));

for (const page of pages) {
  const { meta } = page;
  const canonical = `${siteUrl}${page.url === '/404.html' ? '/' : page.url}`;
  const lds = [];
  for (const s of meta.schema || []) {
    if (s === 'business') lds.push(businessLD());
    else if (s.startsWith('service:')) lds.push(serviceLD(s.split(':')[1]));
  }
  if (page.url !== '/' && page.url !== '/404.html') lds.push(breadcrumbLD(page));
  const faq = faqLD(page.body);
  if (faq) lds.push(faq);
  const jsonld = lds.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');

  let html = layout
    .replace('{{title}}', esc(meta.title))
    .replace(/\{\{ogTitle\}\}/g, esc(meta.title))
    .replace(/\{\{description\}\}/g, esc(meta.description))
    .replace(/\{\{canonical\}\}/g, canonical)
    .replace('{{robots}}', meta.noindex ? 'noindex, follow' : 'index, follow')
    .replace('{{cssV}}', v.css)
    .replace('{{jsV}}', v.js)
    .replace('{{bodyClass}}', meta.bodyClass || '')
    .replace('{{jsonld}}', () => jsonld)
    .replace('{{header}}', () => header(meta))
    .replace('{{content}}', () => page.body)
    .replace('{{footer}}', () => footer(meta))
    .replace('{{tabbar}}', () => tabbar(meta))
    .replace('{{sheet}}', () => sheet());
  html = applyPlaceholderPolicy(applyTokens(html), { strict: STRICT });
  const out = path.join(OUT, page.rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
}

/* sitemap + robots */
const today = new Date().toISOString().slice(0, 10);
const urls = pages.filter((p) => !p.meta.noindex && p.url !== '/404.html');
fs.writeFileSync(
  path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((p) => `  <url><loc>${siteUrl}${p.url}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`,
);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

/* ---------- checks ---------- */
const errors = [];
const outPages = walk(OUT);
for (const f of outPages) {
  const html = read(f);
  for (const [, href] of html.matchAll(/\shref="(\/[^"#?]*)/g)) {
    let target = path.join(OUT, decodeURIComponent(href));
    if (href.endsWith('/')) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) errors.push(`${path.relative(OUT, f)} → broken link ${href}`);
  }
  for (const [, src] of html.matchAll(/\s(?:src|srcset)="(\/[^"\s?]+)/g)) {
    if (!fs.existsSync(path.join(OUT, src))) errors.push(`${path.relative(OUT, f)} → missing asset ${src}`);
  }
}

/* launch-readiness report: every placeholder still on the site */
const cfgPh = [];
(function scan(o, pre) {
  for (const [k, val] of Object.entries(o)) {
    const key = pre ? `${pre}.${k}` : k;
    if (val && typeof val === 'object' && !Array.isArray(val)) scan(val, key);
    else if (isPh(val)) cfgPh.push(`${key} = ${val}`);
  }
})(cfg, '');
if (cfg.profilePdfIsPlaceholder) cfgPh.push('profilePdf is still the placeholder PDF');
if (!cfg.siteUrl) cfgPh.push(`siteUrl is empty (using ${siteUrl})`);
const pagePh = outPages
  .map((f) => [path.relative(OUT, f), (read(f).match(/data-placeholder/g) || []).length])
  .filter(([, n]) => n);

console.log(`Built ${pages.length} pages → ${path.relative(ROOT, OUT)}/  (site URL: ${siteUrl}, mode: ${STRICT ? 'PRODUCTION (strict)' : 'preview'})`);
console.log(`\nLAUNCH CHECKLIST — ${cfgPh.length} config placeholders${STRICT ? " (hidden from the live site until filled in)" : ""}:`);
cfgPh.forEach((p) => console.log(`  [ ] ${p}`));
console.log(`\nPlaceholder blocks still visible on pages:`);
pagePh.forEach(([f, n]) => console.log(`  ${String(n).padStart(3)}  ${f}`));
if (STRICT && pagePh.length)
  errors.push(...pagePh.map(([f, n]) => `${f} → ${n} placeholder(s) would ship to production (fill them in, or mark the block data-optional)`));
if (errors.length) {
  console.error(`\n✖ ${errors.length} problem(s):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('\n✓ All internal links and assets resolve.');
