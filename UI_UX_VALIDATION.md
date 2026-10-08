# UI/UX validation

Completed locally on 14–15 September 2026, against the existing application and research records. No publication, patent, thesis, project, milestone or note content was fabricated or reseeded for the redesign. No deployment was performed.

## Staged visual review

| Phase | Implemented and inspected |
| --- | --- |
| Design foundation | Shared spacing, typography, readable surfaces, responsive CSS/SVG perspective environment; Night and Day desktop/mobile review |
| Navigation | Existing route links, active state, stable search action, mobile menu, Escape, focus return and arrow navigation |
| Homepage | Actual device previews in layered perspective, real project figure, database counts and direct 3D inspection links; desktop and mobile review |
| Research discovery | Native horizontal gallery, search, empty results, complete project index and previous/next controls; desktop/mobile review |
| Case studies | Full hardware cover, active contents, reading sections, figures, zoom/fit dialog and linked lab/patent records; desktop/mobile review |
| Publications | Status counts, persistent filters, document depth, authors/venue and full abstract disclosures; desktop/mobile and empty-filter review |
| Patents | Associated source drawings, inventor/applicant metadata, innovation disclosure and case-study links; desktop/mobile review |
| Theses | Academic cover treatment, index, complete chapter disclosures and retained date caveat; desktop/mobile review |
| Timeline | Visible dates, chronological nodes, category filter and archive links; desktop/mobile review; Education filter returned three existing milestones |
| About | Spatial identity graphic, database themes, named capabilities without percentage scores, preserved academic information; desktop/mobile review |
| Contact | Two-column invitation/form, native required-field focus, preserved endpoint/honeypot/timing/error/success logic; desktop/mobile review; no external message sent |
| Laboratory | Supplied geometry, direct device URLs, AI workstation populated from existing research, themed interface/lighting, 2D return; actual models inspected |
| Notes and search | Editorial notes, readable article view, preserved sanitized content, portfolio search and database results |
| Themes | Night, Day and Blossom inspected on representative pages and laboratory states |
| Responsive/accessibility | Narrow-screen layouts, contained navigation, visible focus, native disclosures/dialogs, full figure access, system reduced motion and touch actions |
| Performance/production | Bounded event-driven page effects, demand-rendered lab, no homepage canvas, production compilation, regression suite and HTTP checks |

## Automated and production checks

- Production build succeeds, including Next.js lint/type validation and route generation.
- Source lint succeeds: `npx eslint src scripts tests --ext .js,.jsx,.ts,.tsx,.cjs,.mjs`.
- Existing security/database/CMS regression suite: **17 reported tests passed, 0 failed** (16 nested cases plus the parent). The stable-identity test now also checks that computational records survive a CMS slug change and exclude private notes.
- Production HTTP checks: **30 route/asset checks**, plus search results and disabled production debugging. Includes all public route categories, every linked research case study and note, model assets, admin entry and unauthenticated admin API rejection.
- Production CSP retains ordinary-page restrictions and confines WebAssembly decoder permission to `/lab`. `/lab/models` returns HTTP 404 in production.
- Missing research slugs use the existing streamed not-found response: the stream has a 404 fallback marker and `noindex`; the HTTP response itself is 200 after streaming begins. This was verified explicitly and is not reported as a true HTTP 404.
- Fresh production browser: homepage had no errors or warnings. Actual microscope loading showed no errors; Three/Fiber emits the existing `THREE.Clock` deprecation warning.
- Production initial JavaScript reported by Next: home 112 kB; research 115 kB; lab entry 115 kB. The Three scene loads separately on entry. These are build estimates, not measurements of complete transfers or device frame rate.
- Mobile DOM checks on home, About, Contact, timeline and article reading reported equal document and viewport widths. Homepage canvas count was zero.

## Contrast and accessibility limits

Computed shared-token contrast ratios (solid colors): muted text on surface is 8.39:1 Night, 6.51:1 Day and 6.18:1 Blossom. Button text is 9.81:1, 6.26:1 and 6.96:1 respectively. These checks do not certify every image, overlay or legacy admin element.

System reduced motion was enabled in the browser environment and respected by the public controls. Pointer tilt implementation was reviewed in source; this session does not claim a physical mouse-motion or mobile GPU benchmark. Browser viewport checks do not replace testing on physical iOS/Android devices or a screen-reader audit. Existing scientific/status/date confirmation notes remain visible.

## Evidence and operation

Local browser screenshots and production HTTP results are in `.qa/ui-ux/` (ignored QA artifacts). `UI_UX_AUDIT.md` records the pre-change review; `DESIGN_SYSTEM.md` documents the implemented components and themes. `LABORATORY.md` and `LABORATORY_VALIDATION.md` retain asset provenance and earlier geometry/fallback checks.

The existing `.env.local` and local development database remain in place. Start the site from the repository with `npm.cmd run dev -- --hostname 127.0.0.1`, then open `http://127.0.0.1:3000`. If a preview is already using port 3000 and database port 55432, use that preview or stop it before starting another instance.

Final tablet check: 768 px viewport, equal document/viewport widths, all navigation links available, Escape closes the menu and restores focus to its toggle. The foreground research-figure preview was reduced at intermediate widths to keep the microgravity label unobstructed.
