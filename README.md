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

Then open http://localhost:3000. This builds the site and starts a local server that sends the same security headers as production. Node 18 or newer is required. The site itself has no dependencies; `npm install` only fetches the test tools.

## Check it (before every push)

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
npm run check
```

`npm run check` runs `lint` (HTML validation + JS syntax) and `test` (29 tests: unit, build guard, end-to-end in Chromium, accessibility with axe-core). GitHub Actions runs the same on every push (`.github/workflows/ci.yml`). The full audit against the Build Quality Gate is in [`QUALITY_GATE_REPORT.md`](QUALITY_GATE_REPORT.md).

## Where things live

```
site.config.json        ← business details: WhatsApp number, phone, email, compliance numbers
src/data/services.json  ← the service lists (used on service pages, quote builder and Google schema)
src/pages/              ← one file per page (the folder = the URL)
src/partials/           ← reusable blocks: CTA band, blueprint drawings, area map
src/layout.html         ← <head>, SEO tags, page shell
src/assets/             ← css, js, fonts, images, docs (PDF)
scripts/build.mjs       ← the build: header/footer, WhatsApp links, schema, sitemap, link checker, release guard
scripts/lib.mjs         ← pure helpers (message formats, placeholder rules), unit-tested
scripts/serve.mjs       ← local server with production headers
tests/                  ← unit, build and end-to-end tests
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

### Preview vs production (the release guard)

- **Preview** (local builds and Vercel preview deploys): placeholders stay visible so you can see what's missing.
- **Production** (Vercel production deploys, or `npm run build:prod`):
  - The build **fails** until `whatsapp`, `email`, `informationOfficer` and the profile PDF are real.
  - Other unfinished blocks (testimonials, project cards, unconfirmed compliance rows, phone, hours…) are **hidden automatically**. Empty sections show an honest fallback, such as "Project photos are on their way".
  - The build fails if any placeholder would still reach the live site.

Markup hooks: `data-optional` (remove in production if it still has a placeholder), `data-collection="x"` + `data-item` (remove the whole group if it has no items left), `data-if-empty="x"` (fallback shown only when group `x` is empty).

Every build prints a **launch checklist** of every placeholder still on the site:

```bash
npm run build
```

## 2. Replace the company profile PDF

Overwrite `src/assets/docs/malepe-rr-company-profile.pdf` with the real one (keep the file name), then set `"profilePdfIsPlaceholder": false` in `site.config.json`.

**Never put the director's ID number or a personal email in the PDF or anywhere on the site.**

## 3. Add project photos

The gallery is generated from **`src/data/projects.json`**. There are 38 carpentry projects so far, sorted into Kitchens, Wardrobes, TV units, Ceilings and Bathrooms. To add one:

1. Keep the untouched original in `media/originals/<slug>.jpg`. This folder is not published.
2. Make two WebP versions with all metadata removed. Phone photos can carry the GPS location of a client's house, and `-strip` deletes it:
   ```bash
   convert media/originals/<slug>.jpg -auto-orient -strip -resize '720x720>' -quality 74 src/assets/img/projects/<slug>-sm.webp
   ```
   ```bash
   convert media/originals/<slug>.jpg -auto-orient -strip -resize '1600x1600>' -quality 78 src/assets/img/projects/<slug>-lg.webp
   ```
3. Add an entry to `projects.json`: `slug`, `category` (`kitchens` | `wardrobes` | `tv-units` | `ceilings` | `bathrooms`), `title`, `alt` (describe what the photo shows), and `w` / `h` (size of the `-sm` file). Optional fields:
   - `location`, `sector`, `year`
   - `"inProgress": true` for work-in-progress shots
   - `"featured": true` to show it on the home page (keep exactly three)
4. Run `npm run check`. The build refuses unknown categories, duplicate slugs, missing images and alt text that's too short.

**Rules for photos:**
- Only your own jobs.
- Blur TV screens that show broadcast content, plus any faces or vehicle number plates.
- Ask the client before publishing photos of their home.

Until a project has `location` / `sector` / `year`, a placeholder appears in preview. It's removed automatically on the live site.

## 4. Testimonials

The home page has two dashed placeholder slots. Only add real quotes, with the client's written permission (name, organisation, project). While the slots are still placeholders, the section is hidden automatically on the live (production) site.

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

### Environment variables (names only, none are secret)

| Name | Set by | Purpose |
|---|---|---|
| `VERCEL_ENV` | Vercel | `production` switches on the release guard |
| `VERCEL_PROJECT_PRODUCTION_URL` | Vercel | Canonical URLs until `siteUrl` is set |
| `STRICT=1` | you | Run the production guard locally (`npm run build:prod`) |
| `SITE_CONFIG`, `OUT_DIR`, `PORT` | tests / you | Alternative config file, output folder, server port |

### Rollback

Vercel keeps every deployment. **Deployments → pick the last good production deployment → Instant Rollback.** To fix forward, `git revert` the bad commit and push.

### Monitoring

Add a free uptime monitor (e.g. UptimeRobot) on the home page with an SMS/email alert. The site has no server, so there are no server logs to watch; Vercel's dashboard shows deploy and edge errors.

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
