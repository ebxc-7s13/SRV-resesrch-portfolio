# Site accent color audit — 2026-10-09

The circular control at the navigation's far right cycles **neon green → deep blue → deep red → green**. The desktop bar reserves an additional 52px. The visible dot is 18px with a 44px button target, a descriptive accessible name, a live status announcement, and native keyboard/touch support. The standalone laboratory header also includes the control.

## Green preservation correction

The user clarified that the original green presentation must remain unchanged. The original green light-card transparency, footer colors/glass chips, emerald utility shades, contact text/placeholders/focus colors, environment symbol, and lab accent shades are restored. Extra contrast rules are scoped explicitly to `data-accent="blue"` and `data-accent="red"`. Green retains only the requested color switch and necessary navigation space.

## Implementation

- `accent-palette.ts` defines the allowed values and pre-paint preference bootstrap. `accent-color.ts` provides one external store, validated local storage, cross-tab synchronization, and subscriptions for running effects.
- `accent-colors.css` supplies separate roles for readable accent text, saturated fills, text on fills, and text on light panels. Dark blue/red surfaces use white text; accent text on dark surfaces uses lighter shades. Light cards use darker accent shades.
- Site-wide CSS, Tailwind fills, footer, navigation, archive pages, forms, search badges, marquees, lab controls, focus rings, cursor assets, and decorative glows consume the palette.
- Cells updates its existing effect options. Cursor canvases and the animated hero name subscribe to changes. The anatomy shader updates shared uniforms; its static fallback uses a matching presentation tint. These changes do not reload model assets.
- In blue and red only, contact inputs retain dark entered text and have darker placeholders/helper copy. Focus outlines use the darker accent shade on the white panel.
- Research photographs, scientific figures, videos, material colors in supplied lab models, anatomical muscle colors, and development-only model-inspector reference colors retain their content meaning. Error colors remain semantic error colors.

## Verification

- Graphify query used to scope navigation, frame, background, and anatomy dependencies; AST graph updated after changes.
- Production build, ESLint, TypeScript, and `git diff --check` pass. All 45 automated tests pass, including eight palette/store tests.
- Browser sweep: 58 route/palette/viewport checks, including public indexes, contact, search results, privacy, terms, standalone lab, play mode, six research detail pages, and three note detail pages. No detected green DOM accents in blue/red mode, horizontal overflow, uncaught page errors, or axe text-contrast violations in the sampled page checks.
- Widths: 320, 375, 390, 768, 1024, 1280, and 1440px. The color control remains within the viewport, including Liquid's PLAY link. A separate touch-enabled 320px context confirms tap cycling. Final screenshots verify the saved red anatomy fallback and readable contact placeholders.
- Browser interactions: reload persistence, synchronization between two tabs, Enter, and Space verified. Settings panels open and close in all five background modes. Cells, Flux, Prism, and Membrane retain the same canvas across color changes; Liquid used its expected reduced-motion fallback in this run.
- Visually inspected screenshots of the real WebGL home in green/blue/red, footer and collaboration panel, blue contact form, laboratory, and 320px navigation. Visual review additionally caught faint form placeholders not reported by axe; corrected in the final build.
- Broad DOM/contrast sweep used the supported WebGL fallback to avoid overloading the software-rendered headless browser. Real WebGL screenshots and effect switching are checked separately. Automated contrast does not assess text over every possible animated canvas pixel.

Artifacts are local to `/tmp/portfolio-mobile-qa/accent-results/`. Verification uses an isolated seeded loopback database, not production data. The pre-existing package-lock change was left untouched. No production deployment was performed.

## Fresh pre-publication audit — 2026-10-09

- Reinstalled the missing Graphify CLI and queried the existing graph for accent, navigation, background, and anatomy dependencies. The named local specialist skill files were unavailable in this environment; verification used direct source review and Playwright.
- Re-ran all 45 tests successfully with the disposable regression database. The sandbox initially blocked loopback sockets; the same tests passed with networking permitted. ESLint, production build, standalone TypeScript check after the build, and whitespace checks passed.
- Re-ran 72 route/palette/viewport checks on the production build with a separately seeded loopback database. Covered all public indexes, all six research details and three blog details, contact, search, privacy, terms, lab, and play; widths included 320, 390, 768, 1024, and 1440 pixels. No uncaught page errors, horizontal overflow, clipped palette controls, or sampled original green DOM accents in blue/red.
- Rechecked reload persistence, cross-tab synchronization, Enter/Space activation, and 320px touch activation. The blue contact form passed axe text-contrast checks. Visually inspected the desktop green home, red contact form, blue footer, red laboratory, and 320px red navigation.
- New browser artifacts are in `/tmp/portfolio-mobile-qa/accent-results/`. The unrelated pre-existing package-lock change remains excluded from this feature release.
