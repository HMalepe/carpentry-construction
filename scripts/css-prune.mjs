// One-off helper (no dependencies): finds CSS rules whose class / id names appear nowhere in the built pages or the site script,
// and rewrites the stylesheet without them. Run after `node scripts/build.mjs` (preview build = superset of the production pages).
//   node scripts/css-prune.mjs            report only
//   node scripts/css-prune.mjs --write    rewrite src/assets/css/main.css
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CSS = path.join(ROOT, 'src/assets/css/main.css');
const src = fs.readFileSync(CSS, 'utf8');

/* ---- what is "used": every class / id token in the built pages, plus every word in the site script ---- */
const used = new Set();
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const f of walk(path.join(ROOT, 'dist')).filter((f) => f.endsWith('.html'))) {
  const h = fs.readFileSync(f, 'utf8');
  for (const m of h.matchAll(/\b(?:class|id)="([^"]*)"/g)) m[1].split(/\s+/).forEach((t) => t && used.add(t));
}
const js = fs.readFileSync(path.join(ROOT, 'src/assets/js/main.js'), 'utf8');
for (const m of js.matchAll(/[A-Za-z_][\w-]*/g)) used.add(m[0]);
// names the build assembles from data (filters per category, per-project focus classes, view-transition names)
const SAFE = [/^f-/, /^fx-/, /^o-/, /^cat-/, /^empty-state$/];
const isUsed = (t) => used.has(t) || SAFE.some((r) => r.test(t));

/* ---- tiny CSS parser: rules and at-rules with blocks, keeping comments out of the way ---- */
function parse(text, i = 0, depth = 0) {
  const nodes = []; let start = i;
  const skipStr = (q) => { i++; while (i < text.length && text[i] !== q) { if (text[i] === '\\') i++; i++; } i++; };
  while (i < text.length) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); const end = e < 0 ? text.length : e + 2; if (text.slice(start, i).trim() === '') { nodes.push({ type: 'comment', text: text.slice(i, end) }); start = end; } i = end; continue; }
    if (c === '"' || c === "'") { skipStr(c); continue; }
    if (c === '(') { let d = 1; i++; while (i < text.length && d) { if (text[i] === '(') d++; else if (text[i] === ')') d--; else if (text[i] === '"' || text[i] === "'") { skipStr(text[i]); continue; } i++; } continue; }
    if (c === '}') { return { nodes, end: i + 1 }; }
    if (c === ';') { nodes.push({ type: 'stmt', text: text.slice(start, i + 1).trim() }); i++; start = i; continue; }
    if (c === '{') {
      const prelude = text.slice(start, i).trim();
      if (/^@(media|supports|layer|container)\b/i.test(prelude)) { const r = parse(text, i + 1, depth + 1); nodes.push({ type: 'at', prelude, children: r.nodes }); i = r.end; }
      else { let d = 1, j = i + 1; while (j < text.length && d) { if (text[j] === '/' && text[j + 1] === '*') { const e = text.indexOf('*/', j + 2); j = e < 0 ? text.length : e + 2; continue; } if (text[j] === '{') d++; else if (text[j] === '}') d--; else if (text[j] === '"' || text[j] === "'") { const q = text[j]; j++; while (j < text.length && text[j] !== q) { if (text[j] === '\\') j++; j++; } } j++; } nodes.push({ type: /^@/.test(prelude) ? 'block' : 'rule', prelude, body: text.slice(i + 1, j - 1) }); i = j; }
      start = i; continue;
    }
    i++;
  }
  return { nodes, end: i };
}
const splitTop = (sel) => { const out = []; let d = 0, cur = ''; for (const ch of sel) { if ('([' .includes(ch)) d++; if (')]'.includes(ch)) d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((s) => s.trim()).filter(Boolean); };
const needs = (selector) => {
  const s = selector.replace(/\[[^\]]*\]/g, '').replace(/:not\([^)]*\)/g, '');   // attribute values and :not(...) never make a rule dead
  return [...s.matchAll(/[.#]([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
};
const removed = [];
function prune(nodes) {
  const out = [];
  for (const n of nodes) {
    if (n.type === 'rule') {
      const sels = splitTop(n.prelude), live = sels.filter((s) => needs(s).every(isUsed));
      if (!live.length) { removed.push(n.prelude); continue; }
      if (live.length < sels.length) removed.push(...sels.filter((s) => !live.includes(s)));
      out.push({ ...n, prelude: live.join(',') });
    } else if (n.type === 'at') { const kids = prune(n.children); if (kids.some((k) => k.type === 'rule' || k.type === 'block' || k.type === 'at')) out.push({ ...n, children: kids }); }
    else out.push(n);
  }
  return out;
}
const ser = (nodes) => nodes.map((n) => n.type === 'comment' ? n.text : n.type === 'stmt' ? n.text : n.type === 'at' ? `${n.prelude}{\n${ser(n.children)}}` : `${n.prelude}{${n.body}}`).join('\n');

const tree = parse(src).nodes;
if (process.argv.includes("--debug")) { const c = {}; tree.forEach((n) => { c[n.type] = (c[n.type] || 0) + 1; }); console.log(c, tree.slice(0, 6).map((n) => n.type + ":" + (n.prelude || n.text || "").slice(0, 50))); }
const pruned = ser(prune(tree)).replace(/\n{3,}/g, '\n\n') + '\n';
// keyframes nobody references any more
let final = pruned;
for (const m of [...pruned.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)]) {
  const name = m[1]; const refs = pruned.split(new RegExp(`\\b${name}\\b`)).length - 1;
  if (refs < 2) { const a = pruned.indexOf(m[0]); let d = 0, j = a + m[0].length - 1; do { if (final[j] === '{') d++; if (final[j] === '}') d--; j++; } while (d && j < final.length); final = final.replace(final.slice(final.indexOf(m[0]), j + (final.indexOf(m[0]) - a)), ''); removed.push('@keyframes ' + name); }
}
const gz = (s) => (await_zlib(s));
function await_zlib(s) { return fs.existsSync('/dev/null') ? require_zlib().gzipSync(Buffer.from(s), { level: 9 }).length : 0; }
import zlib from 'node:zlib';
function require_zlib() { return zlib; }
console.log(`rules removed or trimmed: ${removed.length}`);
console.log(`size  ${src.length} -> ${final.length} bytes   (gzip ${gz(src)} -> ${gz(final)})`);
if (process.argv.includes('--list')) console.log(removed.map((r) => '  ' + r.replace(/\s+/g, ' ').slice(0, 110)).join('\n'));
if (process.argv.includes('--write')) { fs.writeFileSync(CSS, final); console.log('written'); }
