// Malepe R&R site builder — zero dependencies. Run: node scripts/build.mjs
// src/pages/**.html  →  dist/**.html, wrapped in src/layout.html with shared header/footer.
// Business details live in site.config.json; service lists live in src/data/services.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isPh, esc, get, waDigits, waMessage as msg, waHref as href, applyPlaceholderPolicy, criticalProblems, validateProjects, projectCard, projectTeaser, projectFilters, catalogue, CATEGORY_LABEL, respImg } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.resolve(ROOT, process.env.OUT_DIR || 'dist');
const read = (p) => fs.readFileSync(p, 'utf8');
if (OUT === ROOT || OUT === SRC || !OUT.startsWith(ROOT + path.sep)) throw new Error(`Refusing to build into ${OUT}`);

const cfg = JSON.parse(read(path.resolve(ROOT, process.env.SITE_CONFIG || 'site.config.json')));
const services = JSON.parse(read(path.join(SRC, 'data', 'services.json')));
const projects = validateProjects(JSON.parse(read(path.join(SRC, 'data', 'projects.json'))));
const art = JSON.parse(read(path.join(SRC, 'data', 'art.json')));
const cases = JSON.parse(read(path.join(SRC, 'data', 'cases.json')));
const pBy = Object.fromEntries(projects.map((p) => [p.slug, p]));
for (const c of cases) for (const s of [c.cover, ...c.photos.map((x) => x.slug), c.pair?.before, c.pair?.after].filter(Boolean))
  if (!pBy[s]) throw new Error(`cases.json (${c.slug}): unknown project photo "${s}"`);
const caseOf = (slug) => cases.find((c) => c.cover === slug || c.photos.some((x) => x.slug === slug) || c.pair?.after === slug || c.pair?.before === slug);
const linkFor = (slug) => (caseOf(slug) ? `/projects/${caseOf(slug).slug}/` : '/projects/');
const artAttrs = (name) => {
  const c = art.crops.find((x) => x.name === name);
  if (!c) throw new Error(`Unknown art crop: ${name}`);
  return `src="/assets/img/art/${name}.webp" width="${c.w}" height="${c.h}"`;
};
const pimg = (p, size = 'sm', extra = 'loading="lazy" decoding="async"') =>
  `<img src="/assets/img/projects/${p.slug}-${size}.webp" alt="${esc(p.alt)}" width="${p.w}" height="${p.h}"${p.focus ? ` class="fx-${p.focus}"` : ''} ${extra}>`;

function showcase() {
  return projects.filter((p) => p.featured).map((p, i) => `<a class="sc sc-${i + 1}" href="${linkFor(p.slug)}">
        <span class="ph ph-zoom reveal-img"${caseOf(p.slug) ? ` data-vt="${caseOf(p.slug).slug}"` : ''}>${respImg(p, '(min-width:900px) 46vw, 92vw')}</span>
        <div class="sc-body"><h3>${esc(p.title)}</h3><span class="lbl">${esc(CATEGORY_LABEL[p.category])}</span></div>
      </a>`).join('\n      ');
}
function swatches() {
  return `<div class="board">${art.swatches.map((s) => {
    const p = pBy[s.seen];
    return `<a class="swatch" href="${linkFor(s.seen)}"><span class="swatch-tag" aria-hidden="true">${esc(s.label)}</span><span class="ph"><img src="/assets/img/art/swatch-${s.name}.webp" alt="${esc(s.label)} finish, photographed on one of our installations" width="480" height="640" loading="lazy" decoding="async"></span><div class="swatch-meta"><h3>${esc(s.label)}</h3><span class="seen">Seen in: <b>${esc(p.title)}</b></span></div></a>`;
  }).join('')}</div>`;
}
function caseFeatures() {
  return cases.map((c, i) => {
    const p = pBy[c.cover];
    return `<a class="feature" href="/projects/${c.slug}/">
        <span class="ph ph-zoom reveal-img" data-vt="${c.slug}">${respImg(p, '(min-width:900px) 58vw, 92vw')}</span>
        <div class="feature-txt"><span class="lbl">${esc(c.kicker)} · Case study</span><h2 class="mt-12">${esc(c.title)}</h2><p>${esc(c.intro)}</p><span class="btn-text mt-20">Read the project</span></div>
      </a>`;
  }).join('\n      ');
}
function caseBody(c, i) {
  const p = pBy[c.cover];
  const next = cases[(i + 1) % cases.length];
  const specs = c.specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')
    + `<div data-optional><dt>Location</dt><dd><span class="ph-tag" data-placeholder>[Town]</span></dd></div><div data-optional><dt>Year</dt><dd><span class="ph-tag" data-placeholder>[Year]</span></dd></div>`;
  const pair = c.pair ? `<div class="diptych" data-reveal>
          <figure><span class="ph reveal-img">${respImg(pBy[c.pair.before], '(min-width:600px) 45vw, 92vw')}</span><figcaption class="cap"><span>A — During installation</span></figcaption></figure>
          <figure><span class="ph reveal-img">${respImg(pBy[c.pair.after], '(min-width:600px) 45vw, 92vw')}</span><figcaption class="cap"><span>B — At handover</span></figcaption></figure>
        </div>` : '';
  const figs = c.photos.map((x) => `<figure><span class="ph reveal-img">${respImg(pBy[x.slug], '(min-width:900px) 58vw, 92vw')}</span><figcaption class="cap"><span>${esc(x.caption)}</span></figcaption></figure>`).join('');
  return `
<section class="case-hero tone-dark">
  <div class="wrap case-hero-grid">
    <div class="case-hero-txt">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/projects/">Work</a><span aria-hidden="true">/</span><span aria-current="page">${esc(c.title)}</span></nav>
      <p class="lbl">${esc(c.kicker)} · Case study</p>
      <h1 class="h-xl mt-20 lines"><span class="ln"><span>${esc(c.title)}</span></span></h1>
    </div>
    <figure class="case-cover">
      <div class="dimline" aria-hidden="true"><span>${esc(c.title)}</span></div>
      <span class="ph reveal-img" data-vt="${c.slug}">${respImg(p, '(min-width:900px) 40vw, 92vw', 'fetchpriority="high" decoding="async"')}</span>
    </figure>
  </div>
</section>
<section class="sec tone-dark">
  <div class="wrap case-body">
    <div class="case-aside"><div class="case-aside-in">
      <p class="eyebrow"><span class="n"></span>Specification</p>
      <dl class="case-meta">${specs}</dl>
      <div class="acts"><a class="btn btn-primary" data-wa="${c.service}" data-wa-item="${esc(c.item)} (like: ${esc(c.title)})">Quote something similar <span class="arr" aria-hidden="true">→</span></a></div>
    </div></div>
    <div class="case-main">
      <p class="h-s" data-reveal>${esc(c.intro)}</p>
      <div class="prose mt-28" data-reveal="2">${c.body.map((b) => `<p>${esc(b)}</p>`).join('')}</div>
      <div class="case-figs">${pair}${figs}</div>
    </div>
  </div>
</section>
<section class="tone-raised">
  <div class="wrap"><a class="next-case" href="/projects/${next.slug}/"><span class="lbl">Next project</span><h2 class="h-l">${esc(next.title)} →</h2></a></div>
</section>`;
}

// Disciplines with no photos yet get one placeholder slot each (hidden in production).
const PENDING = [{ key: 'construction', label: 'Construction' }, { key: 'maintenance', label: 'Maintenance' }];
const pendingCard = (e, n) => `<article class="proj" data-optional data-item data-cat="${e.key}">
        <div class="ph-photo"><span>PHOTO PENDING<small>[PLACEHOLDER] ${e.label.toLowerCase()} project</small></span></div>
        <div class="proj-body">
          <p class="mono">${e.label}</p>
          <h3><span class="ph-tag" data-placeholder>[Project title]</span></h3>
        </div>
      </article>`;
function projectTokens(html) {
  return html
    .replace('{{projects:showcase}}', showcase)
    .replace('{{projects:catalogue}}', () => catalogue(projects))
    .replace('{{swatches}}', swatches)
    .replace('{{cases:features}}', caseFeatures)
    .replace(/\{\{art:([a-z0-9-]+)\}\}/g, (_, n) => artAttrs(n))
    .replace('{{projects:filters}}', () => projectFilters(projects, PENDING))
    .replace('{{projects:gallery}}', () => [...projects.map((p, i) => projectCard(p, i + 1)), ...PENDING.map((e, i) => pendingCard(e, projects.length + i + 1))].join('\n      '))
    .replace('{{projects:featured}}', () => projects.filter((p) => p.featured).map(projectTeaser).join('\n      '))
    .replace(/\{\{projects:card:([a-z0-9-]+)\}\}/g, (_, slug) => {
      const p = projects.find((x) => x.slug === slug);
      if (!p) throw new Error(`Unknown project slug: ${slug}`);
      return projectTeaser(p);
    })
    .replaceAll('{{projects:count}}', String(projects.length));
}

// STRICT = production. Vercel sets VERCEL_ENV=production only for production deployments, so
// preview deployments keep showing placeholders while production refuses to ship them.
const STRICT = process.env.STRICT === '1' || process.env.VERCEL_ENV === 'production';
if (STRICT) {
  const problems = criticalProblems(cfg);
  if (problems.length && cfg.releaseGuard === 'warn') {
    // TEMPORARY OVERRIDE (releaseGuard: "warn" in site.config.json). The build proceeds; anything that depends on a
    // missing detail is hidden from the live site (data-optional), never shown as a placeholder or a dead link.
    console.warn(`⚠ RELEASE GUARD OVERRIDDEN: shipping without these (set "releaseGuard": "enforce" before the real launch):\n  - ${problems.join('\n  - ')}`);
  } else if (problems.length) {
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
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6z"/><path d="M9.2 8.6c.3-.6.8-.6 1-.2l.7 1.5c.1.3 0 .6-.2.8l-.4.4c.5 1.1 1.4 2 2.5 2.5l.4-.4c.2-.2.5-.3.8-.2l1.5.7c.4.2.4.7-.2 1-1 .6-2.3.6-3.6-.2a8 8 0 0 1-2.7-2.7c-.8-1.3-.8-2.6-.2-3.6z"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
};
// Brand mark: the supplied logo (house, trowel, spanner), traced to SVG. Colours come from CSS (.r red, .c charcoal),
// so the same markup is full-colour on paper and reversed on graphite.
const mark = read(path.join(SRC, 'partials', 'logo-mark.html')).trim();
const logo = `<a class="logo" href="/" aria-label="${esc(cfg.shortName)} — home">${mark}<span class="logo-word">Malepe R&amp;R<small>Pty Ltd</small></span></a>`;

/* ---------- shared chrome ---------- */
const NAV = [
  { key: 'projects', href: '/projects/', label: 'Work' },
  { key: 'services', href: '/services/', label: 'Services' },
  { key: 'contact', href: '/contact/', label: 'Contact' },
];
const cur = (meta, key) => (meta.nav === key ? ' aria-current="page"' : '');

function header(meta) {
  const links = NAV.map((n) => `<a href="${n.href}"${cur(meta, n.key)}>${n.label}</a>`).join('');
  const menuLinks = [{ key: 'home', href: '/', label: 'Home' }, ...NAV, { key: 'quote', href: '/quote/', long: 'Quote request' }]
    .map((n, i) => `<a href="${n.href}"${cur(meta, n.key)}>${esc(n.long || n.label)}</a>`)
    .join('');
  return `<header class="site-head">
  <div class="head-in">
    ${logo}
    <nav class="nav-d" aria-label="Main">${links}</nav>
    <a class="btn btn-ghost btn-sm head-q" data-wa="general">Start a project <span class="arr" aria-hidden="true">→</span></a>
    <details class="menu">
      <summary aria-label="Open menu"><span class="m-open">Menu</span><span class="m-close">Close</span><span class="burger" aria-hidden="true"></span></summary>
      <div class="menu-panel">
        <nav aria-label="Mobile">${menuLinks}</nav>
        <a class="btn btn-primary btn-block" data-wa="general">Start a project on WhatsApp <span class="arr" aria-hidden="true">→</span></a>
        <div class="menu-foot"><p class="lbl lbl-mute">${esc(cfg.locality)} · Maruleng · ${esc(cfg.region)}</p></div>
      </div>
    </details>
  </div>
</header>`;
}

function tabbar() {
  return `<aside aria-label="Quick contact"><a class="fab" data-wa="general" aria-label="Start a project on WhatsApp">${icon.wa}<span aria-hidden="true">WhatsApp</span></a>
  <div class="pickbar" hidden><button class="pickbar-open" type="button" aria-haspopup="dialog" aria-controls="composer"><span class="pickbar-n" data-pick-count>0</span><span class="pickbar-t">jobs shortlisted</span><span class="pickbar-go">Review &amp; send <span aria-hidden="true">→</span></span></button></div></aside>`;
}

function composer() {
  return `<dialog class="sheet composer" id="composer" aria-labelledby="comp-t">
  <div class="sheet-in">
    <div class="sheet-head"><span class="lbl">Your shortlist · WhatsApp</span><button class="sheet-x" type="button" data-close aria-label="Close">${icon.close}</button></div>
    <h2 id="comp-t">Jobs you like</h2>
    <ul class="comp-list" data-comp-list></ul>
    <div class="comp-fields">
      <label for="comp-loc">Where is the job?</label><input id="comp-loc" type="text" autocomplete="address-level2" placeholder="Town or area">
      <label for="comp-note">Anything else we should know?</label><textarea id="comp-note" rows="2" placeholder="Rooms, sizes, finish, when you need it"></textarea>
    </div>
    <div class="bubble"><p class="mono">This is the message we receive</p><pre data-comp-preview></pre></div>
    <a class="btn btn-primary btn-block" data-comp-send href="https://wa.me/{{waNumber}}" target="_blank" rel="noopener">Send on WhatsApp <span class="arr" aria-hidden="true">→</span></a>
    <button class="sheet-more comp-clear" type="button" data-comp-clear>Clear shortlist</button>
  </div>
</dialog>`;
}

function sheet() {
  const opts = Object.entries(services)
    .map(([k, s]) => `<a class="sheet-opt" data-wa="${k}"><span><b>${esc(s.label)}</b><small>${esc(s.short)}</small></span><span class="ar" aria-hidden="true">↗</span></a>`)
    .join('');
  return `<dialog class="sheet" id="quote-sheet" aria-labelledby="sheet-t">
  <div class="sheet-in">
    <div class="sheet-head"><span class="lbl">Start a project · WhatsApp</span><button class="sheet-x" type="button" data-close aria-label="Close">${icon.close}</button></div>
    <h2 id="sheet-t">What are we building?</h2>
    <div class="sheet-opts">${opts}</div>
    <a class="sheet-more" href="/quote/">Build a detailed request (location, timing, client type) →</a>
    <p class="sheet-alt">No WhatsApp on this device? <a href="/contact/">Call or email us instead</a>.</p>
  </div>
</dialog>`;
}

function footer(meta) {
  const svcLinks = Object.values(services).map((s) => `<li><a href="${s.path}">${esc(s.label)}</a></li>`).join('');
  return `<footer class="site-foot">
  <div class="wrap">
    <p class="foot-sign">Bring us the drawing. <em>We’ll bring the tools.</em></p>
    <div class="acts"><a class="btn btn-primary" data-wa="general">Start a project <span class="arr" aria-hidden="true">→</span></a><a class="btn-text" href="/quote/">Detailed quote request</a></div>
    <div class="foot-grid">
      <div class="foot-brand">${logo}
        <p>Construction, maintenance and joinery for government departments, municipalities and private clients in ${esc(cfg.locality)}, Maruleng and surrounds.</p>
      </div>
      <div><p class="lbl">Services</p><ul>${svcLinks}<li><a href="/quote/">Quote request</a></li></ul></div>
      <div><p class="lbl">Company</p><ul><li><a href="/projects/">Work</a></li><li><a href="/contact/">Contact</a></li><li><a href="/privacy/">Privacy (POPIA)</a></li></ul></div>
      <div><p class="lbl">Site office</p><ul>
        <li><a data-wa="general">WhatsApp +{{waNumber}}</a></li>
        <li data-optional>Tel {{cfg.phone}}</li>
        <li data-optional>{{cfg.email}}</li>
        <li data-optional>{{cfg.hours}}</li>
        <li data-optional>{{cfg.address}}</li>
        <li><a data-wa="site">Report a website problem</a></li>
      </ul></div>
    </div>
    <div class="titleblock">
      <div><span class="mono">Drawn by</span>${esc(cfg.name)}</div>
      <div><span class="mono">Sheet</span>${esc(meta.title.split('|')[0].trim())}</div>
      <div><span class="mono">Dwg no.</span>${esc(meta.dwg || 'MRR-000')}</div>
      <div><span class="mono">Scale · Rev</span>1:100 · B</div>
      <div><span class="mono">©</span>${year}</div>
    </div>
  </div>
</footer>`;
}

/* ---------- service list renderers ---------- */
function scopeList(key) {
  const s = services[key];
  const thumbs = s.items.some((it) => it.photo);
  return `<ol class="index${thumbs ? ' has-thumbs' : ''}">${s.items
    .map((it, i) => {
      const p = it.photo && projects.find((x) => x.slug === it.photo);
      if (it.photo && !p) throw new Error(`services.json: unknown photo slug ${it.photo}`);
      const thumb = p ? `<span class="index-thumb ph"><img src="/assets/img/projects/${p.slug}-sm.webp" alt="" width="${p.w}" height="${p.h}" loading="lazy" decoding="async"></span>` : '';
      return `<li>${thumb}<h3>${esc(it.name)}</h3><p>${esc(it.desc)}</p><a class="scope-q idx-act" data-wa="${key}" data-wa-item="${esc(it.name)}" aria-label="Get a quote for ${esc(it.name)} on WhatsApp">Quote <span aria-hidden="true">↗</span></a></li>`;
    })
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
cases.forEach((c, i) => pages.push({
  rel: `projects/${c.slug}/index.html`, url: `/projects/${c.slug}/`,
  meta: { title: `${c.title} | Malepe R&R`, description: c.description, nav: 'projects', crumb: c.title, dwg: `MRR-2${String(i + 1).padStart(2, '0')}` },
  body: caseBody(c, i),
}));
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
  html = projectTokens(html);
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
    emailPh: isPh(cfg.email) ? 'data-placeholder' : '',        // lets data-optional strip email-dependent links in production
    areaInline: esc(cfg.areaServed.join(' · ')),
    areaCount: String(cfg.areaServed.length),
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
// Shared-element transitions: one view-transition-name per case study, generated here so the CSS never drifts from cases.json.
// (Inline styles are blocked by the CSP, so the names live in the stylesheet and are selected by data-vt.)
const vtCss = '\n/* generated: shared-element names (cases.json) */\n' + cases.map((c) =>
  `[data-vt="${c.slug}"]{view-transition-name:vt-${c.slug}}\n::view-transition-group(vt-${c.slug}){animation-duration:.85s;animation-timing-function:cubic-bezier(.65,0,.35,1)}\n::view-transition-old(vt-${c.slug}),::view-transition-new(vt-${c.slug}){height:100%;width:100%;object-fit:cover}\n`).join('');
fs.appendFileSync(path.join(OUT, 'assets/css/main.css'), vtCss);
const v = { css: hash(path.join(OUT, 'assets/css/main.css')), js: hash(path.join(SRC, 'assets/js/main.js')) };
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
    .replace('{{tabbar}}', () => tabbar())
    .replace('{{sheet}}', () => sheet() + composer());
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
