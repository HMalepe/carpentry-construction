# Build Quality Gate: release report

**Product:** Malepe R and R (Pty) Ltd public website (construction, maintenance, carpentry; Hoedspruit / Maruleng, Limpopo)
**Standard:** *The Build Quality Gate: a practical standard for vibe-coded websites and web apps*
**Audited commit range:** `83e189e` (initial build) → `efc6081` (this hardening pass)
**Test references** (#n) are the numbers in `npm test` output.
**Evidence rule used:** PASS = automated test or repeatable step with observed result. FAIL = known defect. NOT TESTED = no valid verification (reason given). N/A = does not apply (reason given).

---

## 1. Executive summary

**Readiness: Production Candidate.** The software meets the gate. **The launch is blocked on business inputs, not code.**

- The code, tests and deployment configuration pass every applicable item that can be verified from this environment: **35/35 automated tests**, **0 axe-core violations**, **0 HTML validation errors** and **0 npm vulnerabilities**.
- The site cannot go live until the owner supplies four facts: the WhatsApp number, a business email, the POPIA Information Officer, and the company profile PDF. This is now *enforced*: a production build on Vercel fails until they're real (section 6).
- Two things were not tested from here and should be done before launch: a real phone, and Safari/Firefox (section 5). The headers have since been verified on the live Vercel preview.

The initial build looked finished but had two **High** defects:

1. **After pressing Back, the quote builder sent a blank request.** The screen still showed the user's choices, but the WhatsApp message they produced was empty. It now passes a regression test, and I confirmed the test fails if the bug is reintroduced.
2. **Nothing stopped a deploy with the placeholder WhatsApp number.** That would have made every quote button on the site a dead end, and "[Project title]" placeholders could also have gone live.

Both are fixed and covered by tests.

## 2. Route and feature inventory

| Route | Purpose | Key interactions |
|---|---|---|
| `/` | Home: hero, services, process, sectors, projects, testimonials, compliance teaser, area served | Start project (WhatsApp sheet), company profile, per-service quote |
| `/services/` | Services hub + "which service do I need?" guide | Per-service quote, links to detail pages |
| `/services/construction/` `/maintenance/` `/carpentry/` | Scope list, pricing approach, what to send, FAQ, related | **Per-job quote button on every scope item** |
| `/projects/` | Filterable gallery (CSS-only filter, works without JS) | Filter, lightbox (activates once real photos exist) |
| `/about/` | Company, working rules, team, area | — |
| `/tenders/` | Compliance register, profile PDF, bid forms, independent verification links | Download PDF, tender WhatsApp message |
| `/contact/` | WhatsApp / phone / email, business details, map link, message tips | Call, email, WhatsApp |
| `/quote/` | Five-step quote builder → preview card → WhatsApp / email / copy | URL pre-fill `?service=&item=`, validation |
| `/privacy/` | POPIA notice | — |
| `404` | Branded not-found page (HTTP 404) | — |

**Roles and authentication:** none. It's a public, anonymous site.
**Data stored:** none. No database, cookies, analytics or forms that submit. The quote builder composes a message on the visitor's own device; the visitor sends it themselves in WhatsApp.
**Integrations:** WhatsApp click-to-chat deep links (`wa.me`), `mailto:`, `tel:`, and a Google Maps search link. No API keys or secrets exist anywhere in the project.
**Environment variables (names only):** `VERCEL_ENV` and `VERCEL_PROJECT_PRODUCTION_URL` (set automatically by Vercel), `STRICT`, `SITE_CONFIG`, `OUT_DIR`, `PORT` (build and test tooling).

## 3. Findings register

### Fixed in this pass

| # | Sev. | Location | Defect | Impact | Fix | Verification |
|---|---|---|---|---|---|---|
| F1 | **High** | `src/assets/js/main.js`, quote builder init | Chrome restores ticked choices *after* `load`, so after Back the preview and WhatsApp message were empty while the screen showed choices | A visitor sends a blank quote request: a lost lead | Re-sync on every `pageshow` | e2e #11; **mutation-checked** (reverting the fix makes it fail) |
| F2 | **High** | `scripts/build.mjs` | No guard against deploying the placeholder WhatsApp number or visible placeholder content | Every quote CTA dead on launch; unfinished content public | Production builds fail on critical placeholders, strip optional ones, show designed empty states | build tests #2–#4, e2e #19 |
| F3 | Medium | `main.css` `.summary .r span` | Text contrast 4.22:1 (WCAG AA needs 4.5:1) | Hard to read for low-vision users | Darker label colour | axe-core e2e #16 |
| F4 | Medium | 52 inline `style=""` attributes; `vercel.json` CSP | CSP had to allow `style-src 'unsafe-inline'` | Weaker defence against injected markup | Utility classes; CSP has no `unsafe-inline` at all | e2e #18 (header) + #8 (no CSP errors at 5 widths) |
| F5 | Medium | repo | No automated tests or CI | Regressions invisible | 29 tests + lint + GitHub Actions | `npm test`, `npm run lint` |
| F6 | Low | `main.js` menu | Escape closed the menu but dropped focus to `<body>` | Keyboard users lose their place | Focus returns to the menu button | e2e #14 |
| F7 | Low | `main.js` copy button | Clipboard rejection failed silently | User thinks the message was copied | Recovery message pointing to WhatsApp / email | e2e #12 |
| F8 | Low | layout, quote page | WhatsApp button outside a landmark; `<aside>` nested in `<main>`; `aria-label` on non-interactive elements | Screen reader navigation noise | Moved / re-marked | axe e2e #16, `npm run lint` |
| F9 | Low | `vercel.json` | Deprecated `interest-cohort` in Permissions-Policy; no explicit HSTS / COOP | Console warnings; weaker transport policy | Updated headers | e2e #18 |
| F10 | Low | `/tenders/`, `/quote/` | Register built from ARIA `div`s; quote builder was a `<form>` that never submits | Less robust semantics | Native `<table>`; `role="group"` | html-validate: 0 errors |
| F11 | Low | dev dependencies | `glob` / `minimatch` advisories via html-validate 9 | Dev tooling only, never shipped | Upgraded to html-validate 11 | `npm audit`: 0 vulnerabilities |
| F12 | Low | section labels | Hiding a block in production would leave numbering gaps (/03 → /06) | Looks broken | CSS counters | e2e #19 + screenshot |
| F13 | Low | `scripts/lib.mjs` | Stripping blocks left trailing whitespace | Validator errors in production output | Line-aware removal | unit #28, lint on both builds |

### Open (needs the owner, or can't be verified from this environment)

| # | Sev. | Item | Why it's open | What's needed |
|---|---|---|---|---|
| O1 | **Critical (launch blocker)** | WhatsApp number, business email, Information Officer, company profile PDF | Business facts only the owner has | Fill in `site.config.json` and replace the PDF. The build enforces this |
| O2 | High | Accuracy of copy: service item lists, About page "four rules", FAQ answers, towns served, "Now accepting projects" pill | Written from the design concepts; code can't verify business truth | Owner reads every page and confirms or edits |
| O3 | Medium | POPIA privacy notice | Plain-language draft; **not legal advice, and completing this checklist is not proof of POPIA compliance** | Qualified review |
| O4 | Medium | Real devices and other browser engines | Only Chromium (desktop + mobile emulation) was tested | iPhone Safari + Android Chrome walkthrough; Firefox smoke test |
| O5 | Low | Performance on the live URL | Headers **verified live** on the Vercel preview (`main`, 2026-11-15): CSP, HSTS, nosniff, DENY, COOP, Permissions-Policy all served exactly as configured. Lighthouse was blocked here | PageSpeed Insights on the production URL after launch |
| O6 | Low | Uptime monitoring | Needs the owner's account | Free uptime monitor on `/` (e.g. UptimeRobot) with SMS / email alert |
| O7 | Low | Hero photo is a licensed stock image (cropped to remove a third-party logo and face) | Authenticity | Replace with an own site photo, now that 38 real project photos exist |
| O9 | Medium | 38 project photos published from the owner's WhatsApp exports | Ownership and client consent can't be verified in code. Metadata stripped; 7 TV screens (broadcast content, incl. TV actors and cartoon characters) and 1 bystander blurred; 1 photo with a "Was R23000" advert overlay excluded | Owner confirms every photo is their own job and that clients agree; adds town / sector / year |
| O8 | Low | Optional business details (phone, address, hours, registration year, compliance numbers) | Hidden automatically in production until real | Fill in as available |

## 4. Changes implemented

| Commit | Slice | Files |
|---|---|---|
| `a74d5ae` | Quote journey: Back-navigation resync, clipboard failure, menu focus | `src/assets/js/main.js` |
| `1eb20fc` | Accessibility, HTML validity, CSP without `unsafe-inline`, HSTS / COOP, server with production header parity | `main.css`, all pages, `layout.html`, `build.mjs`, `serve.mjs`, `vercel.json`, `.htmlvalidate.json` |
| `656988a` | Production release guard, optional blocks, empty states, bug-report route, no-WhatsApp fallback, CSS counters | `scripts/lib.mjs` (new), `build.mjs`, pages, `main.css`, `site.config.json` |
| `efc6081` | Test suite, lint, CI, dev dependencies, `--omit=dev` install on Vercel | `tests/*`, `.github/workflows/ci.yml`, `package.json`, `package-lock.json`, `vercel.json` |

## 5. Tests run: exact results

Run on Node 22.23 with Chromium (Playwright 1.63.0).

```
npm run lint   → html-validate (recommended rules): 0 errors; node --check: OK      exit 0
npm test       → tests 35 · pass 35 · fail 0 · duration ≈25 s                         exit 0
npm audit      → found 0 vulnerabilities
```

| Suite | Tests | Covers |
|---|---|---|
| `tests/unit.test.mjs` | 10 | Placeholder detection, escaping, message format for every button type, URL encoding round-trip, balanced element matching, preview vs production policy, critical-field guard |
| `tests/build.test.mjs` | 6 | Preview build; production blocked on placeholders; `VERCEL_ENV=production` vs `preview`; production output has zero placeholders and shows fallbacks; refuses to write outside the repo; sitemap / robots |
| `tests/e2e.test.mjs` | 13 | All routes + 404; no overflow and no console / CSP errors at 320 / 390 / 768 / 1024 / 1440px; **every** WhatsApp link (more than 60) checked for number and service; full quote journey; Back navigation; clipboard failure; sheet and menu keyboard / focus; no-JS behaviour; axe-core on all pages at 2 sizes; SEO metadata; security headers; production build on screen |

Measured performance (not a Lighthouse score): home page first visit on mobile is **≈64 KB** in total (gzip HTML + CSS + JS + both fonts + 480w hero), CLS 0.000 on every page.

**NOT TESTED, and why:** real iOS / Android devices and the Safari / Firefox engines (no devices or engines available here); Lighthouse / PageSpeed (blocked in this environment); a manual screen-reader pass (VoiceOver / TalkBack); sending a real WhatsApp message (needs the real number, and live messages need the owner's approval).

## 6. Production guard: how launch is enforced

- **Preview deploys** (every branch push on Vercel): placeholders stay visible as orange dashed tags, so the client can see what's missing.
- **Production deploys** (`VERCEL_ENV=production`, or `npm run build:prod` locally):
  1. **Build fails** unless `whatsapp` (27 followed by 9 digits), `email`, `informationOfficer` and the profile PDF are real.
  2. Blocks marked `data-optional` that still hold a placeholder are **removed**. A collection left with no items is removed too, and its `data-if-empty` fallback appears instead (e.g. "Project photos are on their way").
  3. **Build fails** if any placeholder would still reach the page.

## 7. Release gate (gate section 10)

| Item | Status | Evidence / reason |
|---|---|---|
| Critical journeys work end-to-end with real persisted data | **PASS** (journeys) / N/A (persistence) | e2e #9–#13. Nothing is persisted: the "submission" is a WhatsApp message the visitor sends |
| No navigation item, CTA, form or control is a dead end | **PASS** in code; **FAIL** for launch until O1 | Link checker in every build; e2e #9. The WhatsApp number is still a placeholder (O1), and the guard blocks production until it's fixed |
| Authorization tested with multiple users / roles | N/A | No accounts or roles |
| No known critical / high security issue | **PASS** | CSP without `unsafe-inline`, no secrets, 0 vulnerabilities, no server |
| Production build, lint and tests pass | **PASS** | Section 5 |
| Mobile and desktop checked at realistic sizes | **PASS** (Chromium) / **NOT TESTED** (real devices) | 5 widths automated; O4 |
| Loading, empty, success and failure states exist | **PASS** | Quote validation, clipboard failure, empty-state fallbacks, 404, no-WhatsApp fallback |
| Backups and recovery documented for production data | N/A (data) / **PASS** (site) | No production data. Git is the source of truth; Vercel keeps every deployment (rollback in README) |
| Monitoring can reveal failures | **NOT TESTED** | O6: needs the owner's uptime-monitor account |
| Limitations, deferred work and ownership documented | **PASS** | This report + README |

## 8. Full checklist status (gate sections 1–9)

**1. Product and journeys**
- Users, journeys, routes, CTAs: **PASS** (section 2)
- Validation and recovery: **PASS** (e2e #10–#12)
- Empty / error / offline: **PASS** for empty and error states. Offline is N/A: there's nothing to sync, and the browser's offline page applies
- Destructive actions: N/A (none)
- Back navigation keeps work: **PASS** (e2e #11)

**2. UI / UX**
- Design tokens and reusable components: **PASS** (`:root` tokens, shared partials)
- Real copy: **FAIL until O2**
- No fake testimonials or metrics: **PASS** (none invented; slots are removed in production)
- States: hover, focus, selected, error: **PASS**
- Responsive: **PASS** (5 widths)
- Keyboard and visible focus: **PASS** (e2e #13, #14)
- Semantics, alt text, contrast: **PASS** (axe)
- Reduced motion: **PASS** (`prefers-reduced-motion` respected; no animation library)
- Dialogs trap focus and return it: **PASS** (native `<dialog>`, e2e #13)
- Long text at 320px: **PASS**

**3. Frontend engineering**
- Structure: **PASS**
- Business logic separated: **PASS** (`scripts/lib.mjs`)
- Typed contracts: N/A (no API boundary; plain JS by design)
- No secrets or authorization in the browser: **PASS** (none exist)
- Environment config without hard-coded production URL: **PASS** (`siteUrl` falls back to Vercel's variable)
- Dead code and debug logs: **PASS**
- Network request states: N/A (the site makes no network requests)
- Double submit: N/A
- Deep links, refresh, back / forward: **PASS** (static routes; e2e #11)
- Images sized, no layout shift: **PASS** (CLS 0.000)

**4. Backend and database:** N/A. No server, API, database, uploads or stored records. The site is static files on a CDN.

**5. Authentication and security**
- Authentication flows: N/A
- HTTPS: **PASS** (Vercel + HSTS header)
- XSS: **PASS** (build-time escaping, `textContent` only, strict CSP)
- CSRF / insecure direct object references: N/A
- Headers and CSP: **PASS** locally and on the live Vercel preview (2026-11-15)
- Dependencies: **PASS** (0 runtime dependencies, 0 advisories)
- Rate limiting: N/A (no endpoints)
- Privacy documentation: **PASS** as a draft; **legal review needed** (O3)

**6. Integrations**
- WhatsApp documented, with failure fallback: **PASS** (email, copy and contact fallbacks)
- Payments and webhooks: N/A
- Real WhatsApp send: **NOT TESTED** (needs the real number)

**7. Testing**
- Unit, integration and e2e for the actual journeys: **PASS** (29)
- Roles and permissions: N/A
- Real device: **NOT TESTED** (O4)
- Untested areas recorded: **PASS** (section 5)

**8. Performance and SEO**
- Measured: **PASS** (≈64 KB first visit, CLS 0)
- Lazy media: **PASS**
- Unique titles, descriptions and canonicals: **PASS** (e2e #17)
- Sitemap / robots: **PASS**
- Content crawlable without JS: **PASS** (static HTML)
- Accurate structured data: **PASS** (placeholders are excluded from the schema)
- Branded 404: **PASS**
- Lighthouse on the live URL: **NOT TESTED** (O5)

**9. Operations**
- Separate environments: **PASS** (Vercel preview vs production, with the guard tied to `VERCEL_ENV`)
- Env vars documented without values: **PASS**
- Repeatable deploy: **PASS** (`vercel.json` + CI)
- Verify the deployed commit: **PASS** (Vercel preview `2e63d39` on `main` READY; production on the old branch correctly blocked by the guard)
- Domain / DNS: **NOT TESTED** (owner's domain)
- Monitoring: **NOT TESTED** (O6)
- Bug-report route: **PASS** (footer "Report a website problem")
- Test data removed: **PASS** (the fixture lives only in `tests/`)

## 9. Deployment checklist and rollback

1. Fill in `site.config.json`, replace the PDF, then run `npm run check` (lint + 29 tests) and `npm run build:prod` locally. Both must pass.
2. Push. Vercel builds a **preview** for the branch; review it on a real phone.
3. Merge to the production branch. The Vercel production build runs the guard.
4. After the deploy:
   - Check the live URL in securityheaders.com and PageSpeed Insights.
   - Send one real WhatsApp quote from a phone.
   - Submit `sitemap.xml` in Google Search Console.
   - Set up the uptime monitor.
5. **Rollback:** Vercel dashboard → Deployments → previous production deployment → **Instant Rollback** (or *Promote to Production*). Rollback is instant because every deployment is immutable. To forward-fix, revert the commit and push.

## 10. Next improvements (not launch blockers)

1. Replace the stock hero image and the project placeholders with your own photos (biggest trust gain).
2. Google Business Profile with the same name, phone and address as the site (biggest local-SEO gain).
3. Add WebKit to the test matrix (`npx playwright install webkit`) to cover Safari in CI.
4. If analytics are ever added, choose a cookieless option and update the privacy notice first.
