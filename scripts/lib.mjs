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
  if (cfg.profilePdfIsPlaceholder) p.push('profilePdf: replace the placeholder company profile PDF and set profilePdfIsPlaceholder to false.');
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

const img = (p) =>
  `<img src="/assets/img/projects/${p.slug}-sm.webp" alt="${esc(p.alt)}" width="${p.w}" height="${p.h}" loading="lazy" decoding="async">`;

/** Full gallery card. Unknown details (town, sector, year) become an optional placeholder: hidden in production. */
export function projectCard(p, n) {
  const c = CATEGORIES[p.category];
  const known = [p.location, p.sector, p.year].filter(Boolean).map(esc).join(' · ');
  const details = known
    ? `<div><dt>Details</dt><dd>${known}</dd></div>`
    : `<div data-optional><dt>Details</dt><dd><span class="ph-tag" data-placeholder>[Town · sector · year]</span></dd></div>`;
  return `<article class="proj" data-item data-cat="${p.category}">
        <a class="ph-photo has-photo" href="/assets/img/projects/${p.slug}-lg.webp" data-lightbox>${img(p)}</a>
        <div class="proj-body">
          <p class="mono">/${String(n).padStart(2, '0')} · ${c.label}${p.inProgress ? ' · In progress' : ''}</p>
          <h3>${esc(p.title)}</h3>
          <dl class="proj-spec"><div><dt>Scope</dt><dd>${esc(c.scope)}</dd></div>${details}</dl>
        </div>
      </article>`;
}

/** Compact card (home page, service pages) linking to the gallery. */
export function projectTeaser(p) {
  return `<article class="proj" data-item><a class="ph-photo has-photo" href="/projects/">${img(p)}</a><div class="proj-body"><p class="mono">${CATEGORIES[p.category].label}</p><h3>${esc(p.title)}</h3></div></article>`;
}

/** Filter radios + buttons for the categories that actually have projects (no dead filters). */
export function projectFilters(projects, extra = []) {
  const cats = [...Object.keys(CATEGORIES).filter((k) => projects.some((p) => p.category === k)), ...extra.map((e) => e.key)];
  const label = (k) => CATEGORIES[k]?.label || extra.find((e) => e.key === k).label;
  const radios = ['all', ...cats].map((k) => `<input class="f-radio" type="radio" name="pf" id="f-${k}"${k === 'all' ? ' checked' : ''}>`).join('\n    ');
  const buttons = ['all', ...cats].map((k) => `<label for="f-${k}">${k === 'all' ? 'All' : label(k)}</label>`).join('');
  return `${radios}\n    <div class="filters" role="group" aria-label="Filter projects">${buttons}</div>`;
}
