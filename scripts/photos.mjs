// Photo pipeline (dev tool, needs ImageMagick 6 `convert`). Run: npm run photos
// Source of truth: untouched originals in media/originals/<slug>.jpg (never published).
// For every project in src/data/projects.json → src/assets/img/projects/<slug>-sm.webp (720px) and -lg.webp (1600px)
// For every crop / swatch in src/data/art.json  → src/assets/img/art/<name>.webp
// Each output: auto-oriented, metadata stripped (removes GPS), `blur` regions applied (TV screens, bystanders),
// then the house grade, so every phone photo shares one colour language.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIG = path.join(ROOT, 'media/originals');
const OUT = { projects: path.join(ROOT, 'src/assets/img/projects'), art: path.join(ROOT, 'src/assets/img/art') };
const projectsFile = path.join(ROOT, 'src/data/projects.json');
const projects = JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
const art = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/art.json'), 'utf8'));
const bySlug = Object.fromEntries(projects.map((p) => [p.slug, p]));

// House grade: slightly lower saturation, gentle S-curve, warm shadows (takes the blue cast out of phone shots).
const GRADE = { house: ['-modulate', '96,78,100', '-sigmoidal-contrast', '3.2,48%', '-fill', '#3a2c20', '-colorize', '5%'],
                dark: ['-modulate', '72,70,100', '-sigmoidal-contrast', '3.5,45%', '-fill', '#1a140e', '-colorize', '18%'] };

const size = (f) => execFileSync('identify', ['-format', '%w %h', f], { encoding: 'utf8' }).split(' ').map(Number);
function base(slug) {
  const src = path.join(ORIG, `${slug}.jpg`);
  if (!fs.existsSync(src)) throw new Error(`Missing original: media/originals/${slug}.jpg`);
  const [w, h] = size(src);
  const args = [src, '-auto-orient', '-strip'];
  for (const [x0, y0, x1, y1] of bySlug[slug]?.blur || [])
    args.push('-region', `${Math.round((x1 - x0) * w)}x${Math.round((y1 - y0) * h)}+${Math.round(x0 * w)}+${Math.round(y0 * h)}`, '-blur', '0x45', '-blur', '0x45', '+region');
  return { args, w, h };
}
const crop = (w, h, [x0, y0, x1, y1]) => ['-crop', `${Math.round((x1 - x0) * w)}x${Math.round((y1 - y0) * h)}+${Math.round(x0 * w)}+${Math.round(y0 * h)}`, '+repage'];
const webp = (q) => ['-quality', String(q), '-define', 'webp:method=6'];

for (const d of Object.values(OUT)) fs.mkdirSync(d, { recursive: true });
for (const p of projects) {
  const { args } = base(p.slug);
  execFileSync('convert', [...args, ...GRADE.house, '-resize', '720x720>', ...webp(74), path.join(OUT.projects, `${p.slug}-sm.webp`)]);
  execFileSync('convert', [...args, ...GRADE.house, '-resize', '1600x1600>', ...webp(78), path.join(OUT.projects, `${p.slug}-lg.webp`)]);
  [p.w, p.h] = size(path.join(OUT.projects, `${p.slug}-sm.webp`));
}
for (const c of art.crops) {
  const { args, w, h } = base(c.from);
  const out = path.join(OUT.art, `${c.name}.webp`);
  execFileSync('convert', [...args, ...crop(w, h, c.rect), ...GRADE[c.grade || 'house'], '-resize', `${c.width}x>`, ...webp(78), out]);
  [c.w, c.h] = size(out);
}
for (const s of art.swatches) {
  const { args, w, h } = base(s.from);
  const out = path.join(OUT.art, `swatch-${s.name}.webp`);
  execFileSync('convert', [...args, ...crop(w, h, s.rect), ...GRADE.house, '-resize', '480x640^', '-gravity', 'center', '-extent', '480x640', ...webp(76), out]);
}
fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'src/data/art.json'), JSON.stringify(art, null, 2) + '\n');
console.log(`✓ ${projects.length} projects (×2 sizes), ${art.crops.length} crops, ${art.swatches.length} swatches`);
