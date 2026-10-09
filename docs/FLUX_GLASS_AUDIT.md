# Flux defaults and liquid-glass controls — 2026-10-09

## Delivered scope

- New desktop sessions default to Flux with brightness 1, speed 2, and pointer response 2. Mobile/touch sessions default to Liquid. Explicit saved choices and tuning remain respected; Flux reset uses 2/2 and other technical modes retain their original defaults.
- Hero actions and archive links have neutral clear glass, curved rims, highlights, backdrop blur, and pill edges. Shared actions, settings controls, anatomy controls, footer links, search shortcuts, timeline filters and suitable lab controls receive the same material. Existing colored fills, selected/disabled/focus states and click handlers remain intact.
- Blue uses a brighter royal-blue fill and saturated glow; red uses a vivid red fill and glow. Neon-green values are unchanged. Text retains separate readable shades for dark panels, colored fills, and light cards. The footer subtitle is opaque white in blue/red to retain contrast with the brighter fills.
- Content, routes, scientific images, model assets, renderer geometry, shader logic, and form behavior are unchanged. No dependencies or new animation loops were added. The pre-existing package-lock.json edit is excluded.

## Fresh verification

- 48 tests passed, including device defaults, invalid/blocked storage, saved preferences, mode-specific initial/reset/sanitized tuning, stable SSR snapshots, palette/CSS consistency, contrast roles, and existing database/security regressions.
- ESLint, production build, standalone TypeScript after the build, and git whitespace checks passed. Google Fonts required a network-enabled build after the sandbox blocked its existing fetch.
- 33 rendered checks passed across home, contact, timeline, research, search and standalone lab, covering green/blue/red and widths 320, 390, 768 and 1440. No horizontal overflow, uncaught page errors, or sampled button material/radius failures. Fresh mobile touch context selected Liquid; new desktop selected Flux and displayed speed 2 / pointer response 2.
- Axe color-contrast checks on contact, timeline and lab passed in blue/red after correcting the translucent footer subtitle. Palette unit checks retain at least 7:1 accent text contrast on dark panels and at least 4.5:1 for filled controls and light cards. Animated backgrounds and photographic content still require visual judgment.
- Visually inspected desktop royal-blue home, red contact submit, mobile blue home, red footer, and real WebGL Flux with the red theme. The main hero action dimensions match baseline exactly; archive links gain 12px horizontal text inset inside their glass pills.
- Real software-WebGL check confirmed Flux and anatomy initialize, 2/2 settings and reset work, and tuning/color changes retain the same Flux canvas. No page or shader errors occurred. Existing anatomy zoom interaction also remained functional.
- Performance review: changes to speed/response are existing uniforms/time multipliers, with no added geometry or draw calls. Glass is limited to button-sized surfaces, uses 14px desktop / 10px mobile blur, adds no perpetual animation and preserves existing reduced-motion and adaptive-renderer behavior. This headless environment is not a representative hardware FPS benchmark.
- Graphify was queried before work and updated after implementation. Task 1 received a separate spec/code review. An implementation agent then reached its usage limit; root completed the remaining implementation and review directly.

Artifacts: `/tmp/portfolio-mobile-qa/flux-glass-results/`. Browser tooling: regular Playwright because the Browser plugin was unavailable. Tests used an isolated seeded loopback database. This record describes the verified pre-publication tree; the exact production commit and release outcome are recorded by GitHub/Vercel deployment status.
