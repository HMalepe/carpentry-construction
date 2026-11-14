# Malepe R and R (Pty) Ltd: website

The website for a construction, maintenance and carpentry company in Hoedspruit / Maruleng, Limpopo.
It is plain HTML, CSS and JavaScript with **zero dependencies**. One small Node script (`scripts/build.mjs`) adds the shared header and footer to every page and writes the finished site to `dist/`.

- About **63 KB** for a first visit to the home page on mobile (HTML, CSS, JS, fonts and hero image, compressed).
- No cookies, no trackers, no frameworks, no Google Fonts call: the fonts are self-hosted and trimmed to the characters the site uses.
- Every "Get a Quote" button opens WhatsApp with a message that already names the service.

## Run it locally

```bash
npm run dev
```

Then open http://localhost:3000. This builds the site and starts a tiny local server. Node 18 or newer is required; there's nothing to `npm install`.

## Where things live

```
site.config.json        ← business details: WhatsApp number, phone, email, compliance numbers
src/data/services.json  ← the service lists (used on service pages, quote builder and Google schema)
src/pages/              ← one file per page (the folder = the URL)
src/partials/           ← reusable blocks: CTA band, blueprint drawings, area map
src/layout.html         ← <head>, SEO tags, page shell
src/assets/             ← css, js, fonts, images, docs (PDF)
scripts/build.mjs       ← the build: header/footer, WhatsApp links, schema, sitemap, link checker
dist/                   ← generated output (do not edit, not committed)
```

## 1. Put in the real details (do this first)

Open `site.config.json` and replace every value in `[square brackets]` and the `27XXXXXXXXX` number:

| Key | Example | Notes |
|---|---|---|
| `whatsapp` | `27821234567` | Digits only, starting with 27, no leading 0 |
| `phone` | `+27 82 123 4567` | Shown on the site |
| `email` | `info@malepe-rr.co.za` | **A business address, never a personal one** |
| `address`, `hours` | | |
| `regYear` | `2019` | Check it against the CIPC certificate |
| `compliance.*` | | CIPC, CSD (MAAA…), CIDB grade & class, B-BBEE, COIDA, tax status |
| `siteUrl` | `https://www.malepe-rr.co.za` | Your domain once it's connected |

**Placeholder rule:** a value wrapped in `[brackets]`, or containing `XXX`, appears on the site as an orange dashed tag and is left out of the Google schema. Remove the brackets and it becomes normal text.

Every build prints a **launch checklist** of every placeholder still on the site:

```bash
npm run build
```

## 2. Replace the company profile PDF

Overwrite `src/assets/docs/malepe-rr-company-profile.pdf` with the real one (keep the file name), then set `"profilePdfIsPlaceholder": false` in `site.config.json`.

**Never put the director's ID number or a personal email in the PDF or anywhere on the site.**

## 3. Add project photos

1. Resize each photo and export it as WebP at two widths: 800px and 1600px. [squoosh.app](https://squoosh.app) does this in the browser. Aim for quality around 70 and under 120 KB for the 800px file.
2. Save them as `src/assets/img/projects/<name>-800.webp` and `<name>-1600.webp`.
3. In `src/pages/projects/index.html`, follow the comment above the grid: swap a card's `<div class="ph-photo">…</div>` for the `<a … data-lightbox><img …></a>` version, then replace each `[placeholder]` tag with real text.
4. Always write `alt` text describing what's in the photo. It helps both Google and screen readers.

Do the same on the home page (`/04 Projects`) and on each service page's "Related" section.

## 4. Testimonials

The home page has two dashed placeholder slots. Only add real quotes, with the client's written permission (name, organisation, project). If you have none yet, delete the whole `/05 Client feedback` section from `src/pages/index.html`.

## 5. Check the copy

These were written from the design concepts and need a human check:
- The service item lists in `src/data/services.json`. Delete anything you don't offer. Electrical and plumbing are deliberately left out: in South Africa that work needs a registered electrician (CoC) or a PIRB plumber.
- The "Four rules on every site" on the About page, the FAQ answers on the service pages, and the call-out fee answer (Maintenance FAQ).
- `areaServed` in `site.config.json`: the towns you actually work in.
- The About page company story and team.

## 6. Deploy on Vercel

1. Push this repo to GitHub.
2. On vercel.com: **Add New → Project → Import** this repository. `vercel.json` already sets everything: build command `node scripts/build.mjs`, output folder `dist`, clean URLs, cache headers and security headers.
3. Click **Deploy**.
4. Add your domain under **Settings → Domains**, then set `siteUrl` in `site.config.json` and push again. Until then, canonical URLs use Vercel's production URL automatically.

## 7. After launch: get found locally

1. **Google Business Profile** (business.google.com). This matters more than anything else for "construction company Hoedspruit" searches. Use exactly the same name, phone and address as the website, choose the category "General contractor", and add photos.
2. **Google Search Console**: verify the domain and submit `https://<your-domain>/sitemap.xml`.
3. Ask happy clients to leave a Google review. Never write or buy reviews.
4. Check the schema with [Google's Rich Results Test](https://search.google.com/test/rich-results).

## How the WhatsApp quote flow works

- Any `<a data-wa="construction|maintenance|carpentry">` becomes a `wa.me` link at build time, so it works even with JavaScript off. Add `data-wa-item="Built-in cupboards"` to name the specific job.
- `data-wa="general"` (header, floating button) opens a service picker first. Without JavaScript it links straight to WhatsApp.
- `data-wa="tender"` opens a tender/RFQ message instead of a quote message.
- `/quote/` is the step-by-step builder: service, job, location, timing, client type, then a preview card and a pre-written WhatsApp message. Link to it pre-filled with `/quote/?service=carpentry&item=Built-in%20cupboards`.
- The message format is defined in two places, which must stay in step: `waMessage()` in `scripts/build.mjs` and `buildMessage()` in `src/assets/js/main.js`.

## Credits

- Fonts: Space Grotesk and JetBrains Mono (SIL Open Font License, see `src/assets/fonts/`).
- Hero photo: Unsplash (free licence). It's cropped to remove a third-party logo and the person's face. Replace it with your own site photo when you have one.
