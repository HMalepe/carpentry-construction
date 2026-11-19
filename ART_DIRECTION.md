# Art direction: "Graphite Atelier"

The visual identity of the Malepe R&R website, the reasoning behind it, and the rules for keeping it intact.

## 1. The brief and the constraint

The brief asked for an art-directed site that looks agency-made, not template-made. The constraint is the photography. Every company photograph is a WhatsApp export from a phone: 600–1600px, mixed white balance, occasional site clutter.

We did not hide this or replace it with stock. Instead the design:
- grades every photo into one colour language;
- crops for composition instead of filling space;
- never stretches a photo past its native sharpness (case-study covers sit in frames, not full-bleed);
- leads with drawings where we have no photographs (construction, maintenance).

## 2. Directions explored

Three hero prototypes were built and screenshotted at 1440px and 390px before any decision was made.

| Direction | Verdict |
|---|---|
| A · Editorial Ivory (warm paper, serif, offset photo) | Elegant, but the familiar "luxury serif on cream". On mobile the photo falls below the fold. |
| **B · Graphite Atelier** (graphite, timber slats, layered type) | **Chosen.** The company's own charcoal kitchens and slatted TV walls belong to this palette, so the photos look at home rather than imported. It matches the owner's reference image (concrete, walnut, black steel, slatted timber, low-key light). |
| C · Blueprint Evolved (the original navy concept + serif) | Weakest. Navy fights the warm timber and red cabinetry in the photographs. |

Kept from C: the technical-drawing voice (dimension lines, drawing numbers, title block), so the blueprint concept the client approved survives as a detail rather than a theme. Kept from A: ivory paper sections for documents (philosophy, process, tenders, privacy), which give the page a rhythm of tone changes.

## 3. The idea

**Built to the drawing. Finished by hand.** Two voices run through the whole site:

- **The drawing**, which is technical, exact and procurement-ready: JetBrains Mono annotations, dimension lines, sheet numbers, the plan detail of a cupboard-door shadow gap, schedules and registers.
- **The hand**, which is crafted and material: Newsreader italics, timber and gloss photography, finishes sampled from real jobs.

The brand mark is a drawn frame (it draws itself on load) around a monogram made of straight joinery lines.

## 4. Colour

All text pairs pass WCAG AA. Ratios below are computed with the WCAG formula and checked by axe-core in the test suite.

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `--g-950` | #111110 | Primary background (graphite) | — |
| `--g-900` / `--g-850` / `--g-800` | #181716 / #1F1D1B / #2A2825 | Raised surface / photo frames / concrete sections | — |
| `--paper` / `--paper-2` | #EEE9E1 / #E5DFD5 | Document sections / drawing sheets | — |
| `--ivory` | #ECE7DF | Text on graphite; primary button | 15.4:1 on graphite |
| `--stone` | #A8A29A | Secondary text on graphite | 7.5:1 (5.8:1 on concrete) |
| `--ink` / `--ink-mute` | #1B1A18 / #5E584F | Text / secondary text on paper | 14.4:1 / 5.8:1 |
| `--brass` / `--brass-hi` | #B8925C / #CFAE7E | **The only accent** (on dark): labels, numerals, italics, focus ring | 6.6:1 (`--brass-hi` 9.0:1) |
| `--brass-ink` | #7A5A33 | The accent on paper | 5.2:1 |
| `--warn` | #E0A050 | Preview placeholders only (removed in production) | — |

Rules:
- One accent.
- No gradients except photo-legibility scrims.
- Section tone changes (graphite → paper → raised → concrete) are the main way the page breathes.

## 5. Typography

| Role | Face | Setting |
|---|---|---|
| Hero display | Newsreader Light (optical size 72) | clamp(58–188px), line-height .88, tracking −4% |
| Section headings | Newsreader Light | 36–128px, italics in brass for the turn of the phrase |
| Body, UI | Archivo | 17px / 1.6 |
| Labels, nav, buttons | Archivo at 78–85% width | 11–13.5px, uppercase, +14–20% tracking |
| Large numerals (project indices, facts, process) | Archivo at 62% width, Light | 40–330px, tabular figures |
| Technical annotations | JetBrains Mono | 10–11px uppercase, drawing details only |

Heading treatments deliberately vary:
- layered over a photograph (home hero);
- stroked outline numerals (process);
- an expanding index (expertise);
- vertical labels (sample board);
- huge faint numerals (case studies).

All fonts are self-hosted and trimmed to the characters the site uses. Total 155KB.

## 6. Grid, spacing, breakpoints

- 12-column grid ≥900px, 4 columns below. Margin clamp(20–88px), gutter clamp(16–32px), max 1720px.
- Spacing scale: 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128 / 192.
- Breakpoints: 600 (large phone), 900 (tablet / grid switch), 1200 (laptop: desktop nav and expertise stage), 1600 (wide: extra section air).
- Asymmetry is structural: the hero is 8 + 5 columns overlapping, the showcase 6 + 5 offset, case studies alternate 7/4, and gallery spans follow each photo's orientation.

## 7. Components

Buttons (primary, ghost, text-with-rule) · header (transparent → solid on scroll; ink over paper heroes) · full-screen mobile menu · WhatsApp pill (appears after the hero) · service-picker sheet · lightbox (previous/next, arrow keys, swipe, counter) · dimension line · eyebrow with auto-numbering · editorial index rows (with optional thumbnails) · FAQ · fact row · register table · schedule table · sample board · diptych · CTA band · drawing title block (footer).

## 8. Image strategy

**Pipeline (`npm run photos`):**
- Originals live untouched in `media/originals/` and are never published.
- Every output is auto-oriented and stripped of metadata (removes GPS), and has TV screens and bystanders blurred.
- Each photo gets the house grade: −22% saturation, gentle S-curve, warm shadows.
- Art crops and finish swatches are defined in `src/data/art.json`.

| Placement | Image | Why |
|---|---|---|
| Home hero | Charcoal gloss kitchen (separate desktop 4:5 and mobile crops) | Strongest photograph; belongs to the graphite palette; red glass gives one point of colour. |
| Home showcase | Charcoal kitchen · grey gloss wardrobe wall · slatted LED TV wall | Kitchens, wardrobes, feature walls: the three things people come for. |
| Expertise stage | Concrete-look wardrobes under exposed roof trusses (joinery) · elevation drawing (construction) · schedule drawing (maintenance) | Joinery meets structure in one frame; drawings stand in honestly where no photos exist. |
| Sample board | 7 finishes cropped from real jobs | Proof of range, without stock texture libraries. |
| Invitation, Studio | Two installers fitting a kitchen (dark grade) | The only photograph of the team at work: people, process, credibility. |
| Carpentry hero | Light oak wardrobes (1600px) | One of the few photographs sharp enough for full-bleed. |
| Case-study covers | Framed, not full-bleed | Covers are under 720px wide; framing keeps them sharp. |
| Gallery | All 38, orientation-aware spans | A record, lightly graded, never retouched. |

**Never:**
- Stock or generated images presented as company work.
- Upscaling past native resolution.
- Faces, broadcast TV content or number plates without blurring.
- Photographs of a client's home without the client's consent.

## 9. Shot list for a professional photo day (highest return first)

1. **Hero kitchen:** one horizontal 3:2 and one vertical 4:5. Overcast or late daylight plus room lights, no flash, tripod, verticals corrected, clutter removed, 24–35mm.
2. **Details (macro, raking light):** shadow gaps between doors, hinge and drawer runners, edge banding, handle alignment, timber grain, worktop edges.
3. **Workshop and installation:** panel saw, edge-bander, assembly, measuring and levelling on site. Hands and backs, or faces with signed consent.
4. **Before/after from the same tripod position:** this unlocks a true drag-to-compare slider (not built yet, because the current pairs are shot from different angles).
5. **Construction sequence:** setting out, foundations, brickwork to wall plate, truss lift, finished façade at dusk. These replace the drawings on the construction page.
6. **Maintenance:** a roof or gutter repair before and after, and a school or clinic facade (with permission).
7. **Team:** one environmental portrait per person for the Studio page.

Technical: RAW or highest-quality JPEG, ≥3000px long edge, fixed white balance (~5000K), consistent time of day per series.

## 10. Motion

- **Principles:** motion serves reading order and never decorates for its own sake.
  - Reveals are one-shot (IntersectionObserver).
  - No scroll hijacking, no parallax, no continuous animation.
  - Total JS is 3.7KB gzipped.
- **Inventory:**
  - hero photo mask-reveal and headline line-reveal on load;
  - section line-reveals;
  - image mask-reveal with settle-zoom;
  - drawings that draw themselves;
  - nav underline wipe;
  - expanding sample board;
  - expertise index slide;
  - filter fade;
  - lightbox fade;
  - menu stagger;
  - logo frame draw.
- **Accessibility:** everything renders in its final state without JavaScript and under `prefers-reduced-motion`. A regression test checks that every reveal completes after scrolling.

## 11. Signature details (deliberately few)

1. Dimension lines and drawing numbers (the blueprint concept, kept as a detail).
2. The shadow-gap plan detail: joinery is judged in millimetres.
3. The material sample board, cut from the company's own installations.
4. Oversized condensed numerals for projects, stages and facts.
5. The footer as a drawing title block.

## 12. Creative QC: strict external review

| # | Question | Verdict |
|---|---|---|
| 1 | Recognisably different from generic AI sites? | Yes: drawing-plus-hand concept, real finishes board, title-block footer, orientation-aware gallery. No gradient blobs, no stock heroes, no three-card rows. |
| 2 | Visual identity deliberate? | Yes: one accent, three type voices with fixed jobs, tone rhythm by section. |
| 3 | Typography exceptional? | Strong: optical-size display serif, width-variable grotesk for numerals and labels. Will improve further with sharper photography beside it. |
| 4 | Photography professionally art-directed? | **Partly.** Selection, grading, cropping and framing are art-directed; the source files are phone photographs. **This is the main remaining gap.** See the shot list. |
| 5 | Homepage compelling? | Yes: eight scenes, each with its own composition. |
| 6 | Each section its own character? | Yes: overlapping hero, paper manifesto, offset showcase, expanding index, sample board, dimension-line timeline, fact row, full-bleed invitation. |
| 7 | Too many repetitive cards? | No card rows remain. The gallery is the one repeating unit, and it varies by span and offset. |
| 8 | Spacing intentional? | Yes: a single scale, generous section padding that grows at ≥1600px. |
| 9 | Premium without pretension? | Copy stays plain and factual ("Proof, not promises"). No invented numbers. |
| 10 | Animations tasteful? | One-shot, sub-2-second, reduced-motion aware. |
| 11 | Mobile treated equally? | Separate hero crop and composition, numerals inside images, stacked showcase with alternating insets, WhatsApp pill after the hero. Tested at 320–1440px with no overflow. |
| 12 | Commercial trust? | Compliance register, verification links, process, a real-team photograph, quote flow on every page. |
| 13 | Would an established firm be proud of it? | The design, yes. The site becomes fully credible once real testimonials, compliance numbers and professional photographs replace the placeholders. |
| 14 | Agency-quality result? | In structure, type and system, yes. In photography, not until the shoot. |

**Remaining weaknesses, stated plainly:**
- Phone photography.
- No testimonials yet.
- No construction or maintenance photographs.
- A 155KB font cost on first visit (cached afterwards).
