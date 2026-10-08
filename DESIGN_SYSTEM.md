# Research portfolio design system

The existing portfolio remains a database-backed, multi-page research application. Presentation changes support the original records; decorative depth never stands in for scientific evidence.

## Tokens and layout

`src/app/design-system.css` owns the public portfolio tokens. `globals.css` retains functional viewer, carousel, content and utility foundations; its legacy token block is kept synchronized with the design-system token block. Space Grotesk is used for headings, body and display (the former Sora display voice is retired); JetBrains Mono is limited to indices, annotations and technical labels. Spacing follows 4, 8, 12, 16, 24, 32, 48, 64 and 96 px. Content width is 1200 px with 32 px desktop gutters and 20 px mobile gutters. Article reading width is capped at 820 px. Control/card/feature radii are 6/14/24 px. Motion timings are 160/280/520 ms.

The Night theme is the only theme: a dark editorial research-identity palette (near-black page, neutral surfaces, one signal accent) adapted from the byld_research_enhanced reference package. Day and Blossom variants were removed; the theme preference migrates to Night and the switcher offers Night only. A `--faint` token sits below `--muted` for the faintest technical metadata, and the remap layer additionally maps legacy saturated Tailwind utilities (slate/indigo/emerald backgrounds, borders, rings) onto the token system. Technical labels use extended monospace tracking (0.14em) with tabular numerals for measurements. A pointer-safe film-grain veil overlays the fixed background.

| Theme | Page | Surface | Ink | Accent |
| --- | --- | --- | --- | --- |
| Night | #070809 | #0c0e10 | #f2f2ef | #b7ff4a |

The single theme keeps structure and contrast relationships fixed. Landscape wallpapers and autonomous nature effects are no longer mounted.

## Reusable presentation

- `PageHeader`: route index, title, introduction, shared alignment.
- `DepthCard`: research, publication, patent, device, timeline and note variants; bounded pointer tilt with stable hit targets.
- `ResearchCard`: uncropped project imagery, actual status/media counts, title, short reading preview and case-study link.
- `ResearchHero`: layered supplied device previews and a database project figure; native links enter the actual 3D device views.
- `ResearchEnvironment`: one fixed CSS/SVG composition with perspective grid, route-specific contours and pointer lighting; no WebGL outside the lab.
- `CaseStudyContents` and `FigureViewer`: active section navigation, complete captions, native dialog, zoom/fit, Escape and focus return.
- `reading-disclosure`: native publication, thesis and patent disclosure pattern. Complete text remains available.
- `ProjectCarousel`: native horizontal scroll snap, search, previous/next controls and a complete selectable project index. No autoplay.
- `TimelineClient`: visible dates, category filters, aligned milestone cards and archive links.
- `ThemeToggle`, `MotionEffects`, `CursorTrail`: shared preferences, fine-pointer-only cursor, event-driven bounded updates, offscreen/hidden suspension and system reduced-motion support.

## Laboratory

Existing optimized microscope/MMSA geometry, loading tiers, local decoder, orbit controls, research panels and failure fallback are retained. Explicit `?device=microscope` and `?device=mmsa` URLs enter inspection. Ordinary visits keep the lightweight illustrated entry until a station is chosen. The AI workstation uses existing FASCANet/oral-cancer project records, including stable seed identities after CMS renames. Server queries select only public fields. The 3D scene renders on demand and sleeps while offscreen. Theme changes adjust the UI and environmental lighting; instrument geometry is unchanged.

Native anchors enter and leave `/lab` so its document receives the route-specific decoder CSP. Other routes retain the stricter script policy. The development model inspector remains unavailable in production.

## Responsive and accessible behavior

Desktop layouts reflow into one column, with natural horizontal project swiping and full figures on mobile. Hover is never required to reveal research content. Theme controls and main actions have 44 px targets. Keyboard navigation, visible focus, native disclosures, dialog focus return, form validation and reduced motion are retained. System reduced motion cannot be overridden by the public animation control. The lab has HTML station actions and a 2D fallback.

No new package was added. React Bits and Lightswind informed the interaction review; no external component source was copied. See `UI_UX_AUDIT.md` for the source and license decisions and `UI_UX_VALIDATION.md` for checks and limits.
