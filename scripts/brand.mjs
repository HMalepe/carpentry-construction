// Brand assets from the logo mark (dev tool, needs Playwright's Chromium). Run: npm run brand
// Writes: favicon.svg, apple-touch-icon.png, icon-512.png, img/og-default.png
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = path.join(ROOT, 'src/assets');
const mark = fs.readFileSync(path.join(ROOT, 'src/partials/logo-mark.html'), 'utf8').trim();
const RED = '#9F2D32', CHAR = '#282828', PAPER = '#EEE9E1', GRAPHITE = '#111110', IVORY = '#ECE7DF', CORAL = '#E8736C';
// Fonts are embedded as data URIs: setContent() pages cannot load file:// fonts.
const b64 = (n) => `data:font/woff2;base64,${fs.readFileSync(path.join(A, 'fonts', n)).toString('base64')}`;
const fontCss = () => `@font-face{font-family:AR;src:url(${b64('archivo.woff2')});font-weight:100 900;font-stretch:62% 100%}`;

// Favicon: the full-colour mark on a paper tile (stays legible in dark and light browser chrome).
const inner = mark.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(/class="r"/g, `fill="${RED}"`).replace(/class="c"/g, `fill="${CHAR}"`);
fs.writeFileSync(path.join(A, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${PAPER}"/><svg x="8" y="9" width="48" height="46" viewBox="12 25 171 162">${inner}</svg></svg>\n`);

const b = await chromium.launch();
const p = await b.newPage();
const tile = (s) => `<body style="margin:0;width:${s}px;height:${s}px;background:${PAPER};display:grid;place-items:center"><div style="width:${s * 0.7}px">${mark.replace('<svg ', '<svg style="width:100%;height:auto;display:block" ')}</div><style>.r{fill:${RED}}.c{fill:${CHAR}}</style></body>`;
for (const [s, f] of [[180, 'apple-touch-icon.png'], [512, 'icon-512.png']]) {
  await p.setViewportSize({ width: s, height: s });
  await p.setContent(tile(s));
  await p.screenshot({ path: path.join(A, f) });
}
await p.setViewportSize({ width: 1200, height: 630 });
await p.setContent(`<style>${fontCss()}*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:${GRAPHITE};color:${IVORY};font-family:AR;position:relative;overflow:hidden}
.slats{position:absolute;top:0;bottom:0;right:0;width:46%;background:repeating-linear-gradient(90deg,#1c1b19 0 26px,#131312 26px 32px)}
.slats::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,${GRAPHITE},transparent 40%)}
.mk{position:absolute;right:60px;top:56px;width:250px}.mk svg{width:100%;height:auto;display:block}.r{fill:#C93C41}.c{fill:${IVORY}}
.wm{position:absolute;left:72px;top:64px;font-weight:700;font-stretch:72%;font-size:26px;letter-spacing:.16em;text-transform:uppercase}
.wm small{display:block;font-weight:400;font-size:14px;letter-spacing:.3em;color:#A8A29A;margin-top:6px}
h1{position:absolute;left:72px;bottom:150px;font-family:AR;font-stretch:68%;font-weight:700;text-transform:uppercase;font-size:110px;line-height:.95;letter-spacing:.005em}
h1 em{color:${CORAL};font-style:italic}
.ft{position:absolute;left:72px;bottom:60px;font-size:22px;letter-spacing:.06em;color:#A8A29A}
.bar{position:absolute;left:0;bottom:0;height:8px;width:100%;background:#9F2D32}</style>
<div class="slats"></div><div class="mk">${mark}</div>
<div class="wm">Malepe R&amp;R<small>Pty Ltd</small></div>
<h1>Built to the drawing.<br><em>Finished by hand.</em></h1>
<div class="ft">Construction · Joinery · Maintenance — Hoedspruit &amp; Maruleng, Limpopo</div><div class="bar"></div>`);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);
await p.screenshot({ path: path.join(A, 'img/og-default.png') });
await b.close();
console.log('✓ favicon.svg, apple-touch-icon.png, icon-512.png, og-default.png');
