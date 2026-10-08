# Rendered UI audit and component decisions

Inspected the running application before presentation changes on 14 September 2026. Routes: `/`, `/lab` (including active microscope inspection), `/research`, `/research/microgravity-platform`, `/publications`, `/thesis`, `/patents`, `/timeline`, `/blog`, `/about`, `/contact`. The brief's `/theses` corresponds to the existing `/thesis` route. Inspected Night, Day and Blossom, desktop and 390 × 844 mobile layouts, the mobile navigation, publication filter empty state, case-study scrolling and browser diagnostics.

## Findings

- Repeated oversized centered page headers delay access to the records. Archive pages look alike despite different reading tasks.
- The research carousel begins far below the fold, crops images, and exposes only one project to assistive technology. Mobile has a particularly large gap before the active card.
- The project cover crops real hardware. Contents labels truncate, while reading sections have inconsistent accent colors and limited navigation support.
- Publication descriptions become very long undifferentiated blocks. Filters work and have a meaningful empty state; retain them.
- Thesis nodes, timeline cards and research carousels repeat similar depth treatments. Timeline year markers can be invisible, weakening chronology.
- About contains unsupported skill percentages; remove the scores and retain the named capabilities.
- Day's clouds, grass and butterflies and Blossom's full-screen landscape compete with evidence. The translucent navigation can lose contrast over figures. Night's black surfaces have little tonal separation.
- Mobile hides the homepage imagery, and the floating theme controls compete with content. The site needs consistent touch targets and a contained navigation panel.
- The lab already has useful device inspection, genuine optimized assets, record panels, keyboard camera controls and 2D fallback. Preserve its working interaction and source mappings; connect it more clearly with project pages.

## Inventory and reuse decisions

| Existing component/system | Decision |
| --- | --- |
| `SiteContent` and server page queries | Preserve CMS slots, metadata and database ownership of content |
| `Navigation`, `Footer`, `PortfolioFrame` | Enhance the existing links and page shell; keep separate routes |
| `ThemeToggle`, `MotionEffects`, `CursorTrail` | Consolidate controls and replace competing ambient effects with a bounded shared system |
| `FigureViewer` | Preserve native dialog, caption, original-image access and focus return; enhance figure navigation |
| `ProjectCarousel`, `ResearchCarousel` | Reuse data contracts; improve discovery with visible project index and deliberate image depth |
| `ThesisFlow`, `TimelineClient` | Preserve records and reading/disclosure behavior; improve chronology and document hierarchy |
| `ResearchDevice`, `LabScene`, `LabExperience` | Preserve real GLBs, lazy loading, quality tiers, inspection and fallback |
| `ContentReviewNote` | Preserve factual confirmation notes with readable, restrained styling |
| Admin/CMS, APIs, PostgreSQL and auth | Preserve behavior and regression checks |

New primitives are deliberately limited: shared page header, card surface, route environment, case-study contents and archive disclosures. Card variants share depth, spacing, focus and surface tokens; no separate animation framework for each page.

## External component investigation

- [React Bits Tilted Card source](https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Components/TiltedCard/TiltedCard.tsx): pointer-relative tilt with Motion springs and image overlays. Its [license](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md) is MIT plus Commons Clause, not unrestricted MIT. Its default hover tooltip/mobile warning and additional Motion dependency are unnecessary here. Use a small original CSS-variable interaction with persistent captions and reduced-motion support instead of copying the component.
- [Lightswind component catalog](https://lightswind.com/components): reviewed perspective cards and magnetic buttons. The [license page](https://www.lightswind.com/license) distinguishes free MIT components from paid assets. No paid or gated source is used. A moving navigation hit target is less useful than a stable link with a responsive indicator, so keep navigation targets fixed.
- Existing Three/Fiber/Drei packages already support the device experience. No extra WebGL renderer, particle library, carousel package or animation package is required for the rest of the site.

Validation is staged: inspect rendered changes after each route/system phase, then check mobile, themes, keyboard/reduced motion, browser errors, asset loading, regression tests and production build. Screenshots are evidence of local rendering, not physical-device performance measurements.
