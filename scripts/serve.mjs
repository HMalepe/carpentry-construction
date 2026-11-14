// Local static server for dist/ with production parity: mimics Vercel's cleanUrls + trailingSlash
// and sends the same response headers as vercel.json (incl. the Content-Security-Policy), so
// header problems show up locally and in the e2e tests, not first in production.
// Run: npm run dev   (PORT env var to change the port)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, process.env.OUT_DIR || 'dist');
const PORT = Number(process.env.PORT) || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).headers.map((r) => ({ re: new RegExp(`^${r.source}$`), headers: r.headers }));

export function createServer() {
  return http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!path.extname(url) && !url.endsWith('/')) { res.writeHead(308, { Location: url + '/' }); return res.end(); }
    let file = path.join(DIST, url.endsWith('/') ? url + 'index.html' : url);
    if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
    let status = 200;
    if (!fs.existsSync(file)) { file = path.join(DIST, '404.html'); status = 404; }
    for (const r of rules) if (r.re.test(url)) for (const h of r.headers) res.setHeader(h.key, h.value);
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.writeHead(status);
    fs.createReadStream(file).pipe(res);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  createServer().listen(PORT, () => console.log(`Serving ${path.relative(ROOT, DIST)}/ on http://localhost:${PORT}`));
}
