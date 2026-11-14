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

const removeRanges = (html, ranges) =>
  ranges.sort((a, b) => b.start - a.start).reduce((h, r) => h.slice(0, r.start) + h.slice(r.end), html);

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
