// Pure helpers used by build.mjs. No file system, no globals: unit-tested in tests/unit.test.mjs.

/** A config value is a placeholder if it is wrapped in [brackets] or contains XXX. */
export const isPh = (v) => typeof v === 'string' && (/^\[[\s\S]*\]$/.test(v.trim()) || /X{3,}/.test(v));

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const get = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/** Digits-only WhatsApp number (keeps X so placeholders stay recognisable). */
export const waDigits = (n) => String(n).replace(/[^\dX]/g, '');

/**
 * The pre-filled WhatsApp message for a given button.
 * Keep the opening line in sync with buildMessage() in src/assets/js/main.js.
 * @param {string} brand  short company name
 * @param {object} services  services.json
 * @param {string} key  construction | maintenance | carpentry | general | tender | site
 * @param {string} [item]  a specific job, e.g. "Built-in cupboards"
 */
export function waMessage(brand, services, key, item) {
  if (key === 'tender')
    return [`Hi ${brand}, I'm contacting you about a tender / RFQ.`, 'Tender / RFQ no.: ', 'Organisation: ', 'Documents needed: '].join('\n');
  if (key === 'site')
    return [`Hi ${brand}, I found a problem on your website.`, 'Page: ', 'What happened: ', 'Phone / browser: '].join('\n');
  const lines = [`Hi ${brand}, I'd like a quote.`];
  const svc = services[key];
  if (!svc) lines.push('Service: (Construction / Maintenance / Carpentry)');
  else lines.push(`Service: ${svc.label}${item ? ` › ${item}` : ''}`);
  lines.push('Location: ', 'Details: ');
  return lines.join('\n');
}

export const waHref = (number, text) => `https://wa.me/${waDigits(number)}?text=${encodeURIComponent(text)}`;

/**
 * Find the full outer HTML range of every element whose opening tag matches `attrRe`.
 * Balanced on tag name, so nested elements of the same type are handled. Returns [{start, end, open, tag}].
 */
export function findElements(html, attrRe) {
  const out = [];
  const openRe = /<([a-zA-Z][\w-]*)\b([^>]*)>/g;
  let m;
  while ((m = openRe.exec(html))) {
    if (!attrRe.test(m[2])) continue;
    const tag = m[1].toLowerCase();
    const scan = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    scan.lastIndex = openRe.lastIndex;
    let depth = 1, s;
    while (depth && (s = scan.exec(html))) depth += s[1] ? -1 : 1;
    if (depth) throw new Error(`Unclosed <${tag}> with ${attrRe} near: ${html.slice(m.index, m.index + 80)}`);
    out.push({ start: m.index, end: scan.lastIndex, open: m[0], tag });
    openRe.lastIndex = scan.lastIndex; // skip nested matches inside a matched element
  }
  return out;
}

/** Remove ranges; when an element sits on its own line(s), remove its indentation and line break too. */
const removeRanges = (html, ranges) =>
  ranges
    .sort((a, b) => b.start - a.start)
    .reduce((h, r) => {
      let { start, end } = r;
      const lineStart = h.lastIndexOf('\n', start - 1) + 1;
      if (/^[ \t]*$/.test(h.slice(lineStart, start)) && /^[ \t]*(\n|$)/.test(h.slice(end))) {
        start = lineStart;
        end += h.slice(end).match(/^[ \t]*\n?/)[0].length;
      }
      return h.slice(0, start) + h.slice(end);
    }, html);

/**
 * Production clean-up.
 * 1. Every element marked data-optional that still contains a placeholder is removed.
 * 2. Every data-collection="x" left with no data-item inside is removed, and the matching
 *    data-if-empty="x" fallback is kept; otherwise the fallback is removed.
 * In preview mode (strict=false) placeholders stay visible and fallbacks are removed.
 */
export function applyPlaceholderPolicy(html, { strict }) {
  if (strict) {
    const opt = findElements(html, /\sdata-optional\b/).filter((r) => html.slice(r.start, r.end).includes('data-placeholder'));
    html = removeRanges(html, opt);
  }
  const empty = new Set();
  const cols = findElements(html, /\sdata-collection="/).filter((r) => {
    const inner = html.slice(r.start + r.open.length, r.end);
    if (/\sdata-item\b/.test(inner)) return false;
    empty.add(r.open.match(/data-collection="([^"]+)"/)[1]);
    return true;
  });
  html = removeRanges(html, cols);
  const fallbacks = findElements(html, /\sdata-if-empty="/).filter((r) => !empty.has(r.open.match(/data-if-empty="([^"]+)"/)[1]));
  return removeRanges(html, fallbacks);
}

/** Critical business details that must be real before a production build may succeed. */
export function criticalProblems(cfg) {
  const p = [];
  if (isPh(cfg.whatsapp) || !/^27\d{9}$/.test(waDigits(cfg.whatsapp)))
    p.push('whatsapp: must be a real SA number in the form 27XXXXXXXXX (11 digits). Every quote button depends on it.');
  if (isPh(cfg.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.email)) p.push('email: must be a real business email address.');
  if (isPh(cfg.informationOfficer) || !cfg.informationOfficer) p.push('informationOfficer: POPIA requires a named Information Officer on the privacy notice.');
  return p;
}

/* ---------- project gallery (data: src/data/projects.json) ---------- */

/** Gallery categories. Every project's `category` must be one of these (CSS filters exist for each). */
export const CATEGORIES = {
  kitchens: { label: 'Kitchens', scope: 'Kitchen units' },
  wardrobes: { label: 'Wardrobes', scope: 'Built-in cupboards' },
  'tv-units': { label: 'TV units', scope: 'TV units & feature walls' },
  ceilings: { label: 'Ceilings', scope: 'Ceilings & bulkheads' },
  bathrooms: { label: 'Bathrooms', scope: 'Bathroom vanities' },
};

/** Throws with a clear message if projects.json is malformed. */
export function validateProjects(projects) {
  const seen = new Set();
  for (const [i, p] of projects.entries()) {
    const where = `projects.json[${i}] (${p.slug || 'no slug'})`;
    for (const k of ['slug', 'category', 'title', 'alt', 'w', 'h']) if (!p[k]) throw new Error(`${where}: missing "${k}"`);
    if (!CATEGORIES[p.category]) throw new Error(`${where}: unknown category "${p.category}" (use one of ${Object.keys(CATEGORIES).join(', ')})`);
    if (!/^[a-z0-9-]+$/.test(p.slug)) throw new Error(`${where}: slug must be lowercase letters, digits and dashes`);
    if (seen.has(p.slug)) throw new Error(`${where}: duplicate slug`);
    if (p.alt.length < 20) throw new Error(`${where}: alt text too short; describe what the photo shows`);
    seen.add(p.slug);
  }
  return projects;
}

/** Responsive <img>: the browser picks 720 / 1100 / 1600px by screen width and pixel density. */
export const srcset = (p) => [`/assets/img/projects/${p.slug}-sm.webp ${p.w}w`, p.mw > p.w && `/assets/img/projects/${p.slug}-md.webp ${p.mw}w`, p.lw > (p.mw || p.w) && `/assets/img/projects/${p.slug}-lg.webp ${p.lw}w`].filter(Boolean).join(', ');
export const respImg = (p, sizes, extra = 'loading="lazy" decoding="async"') =>
  `<img src="/assets/img/projects/${p.slug}-sm.webp" srcset="${srcset(p)}" sizes="${sizes}" alt="${esc(p.alt)}" width="${p.w}" height="${p.h}" ${extra}>`;
// Card widths measured at 360-1920px: a phone card is the viewport minus the page margins (not 58vw), so phones and
// iPads were asking for a lower tier than their screens need. Spanning (wide / panorama) cards are larger.
// object-fit: cover also magnifies a photo that is wider than its frame (4:3 landscape, 4:5 portrait, 21:9 panorama),
// so the hint is multiplied by how much wider than the frame the photo is.
const FRAME = { 'o-landscape': 4 / 3, 'o-portrait': 4 / 5, 'o-pano': 21 / 9 };
const cardSizes = (p, wide) => {
  const o = orientation(p);
  const spans = wide || o === 'o-pano';
  const f = Math.max(1, (p.w / p.h) / FRAME[o]);
  const m = (v) => (f > 1.001 ? `calc((${v}) * ${f.toFixed(2)})` : v);
  return `(min-width:900px) ${m(spans ? '60vw' : '31vw')}, (min-width:600px) ${m(spans ? '90vw' : '46vw')}, ${m('100vw - 42px')}`;
};
const SIZES_TEASER = '(min-width:900px) 46vw, (min-width:600px) 90vw, calc(100vw - 42px)';
const img = (p, sizes) => respImg(p, sizes);

export const CATEGORY_LABEL = Object.fromEntries(Object.entries(CATEGORIES).map(([k, v]) => [k, v.label]));

/** Layout class from the photo's proportions: portraits stand tall, wide shots span more columns. */
export function orientation(p) {
  const r = p.w / p.h;
  return r < 0.9 ? 'o-portrait' : r > 1.9 ? 'o-pano' : 'o-landscape';
}

/** Full gallery card. Unknown details (town, sector, year) become an optional placeholder: hidden in production. */
export function projectCard(p, n) {
  const c = CATEGORIES[p.category];
  const known = [p.location, p.sector, p.year].filter(Boolean).map(esc).join(' · ');
  const details = known
    ? `<div><dt>Details</dt><dd>${known}</dd></div>`
    : `<div data-optional><dt>Details</dt><dd><span class="ph-tag" data-placeholder>[Town · sector · year]</span></dd></div>`;
  const wide = orientation(p) === 'o-landscape' && n % 5 === 1 ? ' wide' : '';
  return `<article class="proj ${orientation(p)}${wide}" data-item data-cat="${p.category}">
        <a class="ph-photo has-photo" href="/assets/img/projects/${p.slug}-lg.webp" data-lightbox>${img(p, cardSizes(p, !!wide))}</a>
        <div class="proj-body">
          <p class="mono">${c.label}${p.inProgress ? ' · In progress' : ''}</p>
          <h3>${esc(p.title)}</h3>
          <dl class="proj-spec"><div><dt>Scope</dt><dd>${esc(c.scope)}</dd></div>${details}</dl>
          ${pickBtn(p)}
        </div>
      </article>`;
}

/** Compact card (home page, service pages) linking to the gallery. */
export function projectTeaser(p) {
  return `<article class="proj" data-item><a class="ph-photo has-photo" href="/projects/">${img(p, SIZES_TEASER)}</a><div class="proj-body"><p class="mono">${CATEGORIES[p.category].label}</p><h3>${esc(p.title)}</h3></div></article>`;
}

/** Filter radios + buttons for the categories that actually have projects (no dead filters). */
export function projectFilters(projects, extra = []) {
  const cats = [...Object.keys(CATEGORIES).filter((k) => projects.some((p) => p.category === k)), ...extra.map((e) => e.key)];
  const label = (k) => CATEGORIES[k]?.label || extra.find((e) => e.key === k).label;
  const radios = ['all', ...cats].map((k) => `<input class="f-radio" type="radio" name="pf" id="f-${k}"${k === 'all' ? ' checked' : ''}>`).join('\n    ');
  const buttons = ['all', ...cats].map((k) => `<label for="f-${k}">${k === 'all' ? 'All' : label(k)}</label>`).join('');
  return `${radios}\n    <div class="filters" role="group" aria-label="Filter projects">${buttons}</div>`;
}

/* ---------- catalogue (home page): one rail per category, tiles keep each photo's own proportions ---------- */

/** Shortlist toggle. Hidden until the script enhances it; the plain "Quote this" link below works without JS. */
const pickBtn = (p) => `<button class="pick" type="button" hidden aria-pressed="false" data-pick="${p.slug}" data-title="${esc(p.title)}" data-cat="${esc(CATEGORIES[p.category].label)}"><span class="pick-on" aria-hidden="true">+</span><span class="pick-t">Shortlist</span></button>`;

/** A catalogue tile is as tall as --th (300-400px) and as wide as its photo allows (0.74x to 1.9x of that height). */
export function tileSizes(p) {
  const k = Math.min(1.9, Math.max(0.74, p.w / p.h)).toFixed(2);
  return `(min-width:900px) ${Math.round(400 * k)}px, calc(clamp(300px, 80vw, 400px) * ${k})`;
}

export function catalogueTile(p) {
  const c = CATEGORIES[p.category];
  return `<li class="tile" data-item>
          <a class="tile-ph ph has-photo" href="/assets/img/projects/${p.slug}-lg.webp" data-lightbox>${respImg(p, tileSizes(p))}</a>
          <div class="tile-body">
            <h4>${esc(p.title)}</h4>
            <p class="mono">${esc(c.scope)}${p.inProgress ? ' · In progress' : ''}</p>
            <div class="tile-acts">${pickBtn(p)}<a class="tile-q" data-wa="carpentry" data-wa-item="${esc(c.scope)} (like: ${esc(p.title)})" aria-label="Quote a job like: ${esc(p.title)}">Quote this <span aria-hidden="true">↗</span></a></div>
          </div>
        </li>`;
}

/** One horizontal rail per category that has projects. */
export function catalogue(projects) {
  return Object.entries(CATEGORIES)
    .map(([key, c]) => {
      const list = projects.filter((p) => p.category === key);
      if (!list.length) return '';
      return `<section class="cat" aria-labelledby="cat-${key}">
        <div class="cat-head">
          <h3 id="cat-${key}">${esc(c.label)}</h3>
          <span class="rail-ctl" hidden><button class="rail-btn" type="button" data-rail="-1" aria-label="Scroll ${esc(c.label)} back">←</button><button class="rail-btn" type="button" data-rail="1" aria-label="Scroll ${esc(c.label)} forward">→</button></span>
        </div>
        <ul class="rail" tabindex="0" aria-label="${esc(c.label)}: scroll sideways">
        ${list.map(catalogueTile).join('\n        ')}
        </ul>
      </section>`;
    })
    .join('\n      ');
}
