# Flux defaults, liquid-glass buttons, and luminous accents Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship desktop Flux (speed 2, pointer response 2), mobile Liquid, rounded liquid-glass buttons, and luminous royal-blue/red themes.

**Architecture:** Keep the existing background store and renderer. Resolve tuning defaults per mode. Use the existing accent roles across CSS/canvas; add a scoped CSS button material that retains semantic fills and adds no rendering loop.

**Tech Stack:** Next.js, React, TypeScript, CSS, existing Three.js, node:test, Playwright.

**Spec:** The user's 2026-10-09 request in this conversation; requirements restated in the tasks below.

## Global Constraints

- Desktop default Flux: speed 2, pointer response 2. Mobile default Liquid.
- Preserve explicit saved background choices and tuning; defaults apply to fresh/invalid/blocked storage and reset. Keep other scene defaults unchanged.
- Preserve neon green. Blue becomes glowing royal blue; red becomes glowing vivid red. Maintain readable contrast roles on dark surfaces, filled controls, and light cards.
- Hero action/archive buttons use clear, colorless liquid glass. Other suitable buttons retain their colored fills and gain liquid-glass highlights and fully rounded edges.
- Preserve routes, content, research assets, surrounding layout, main action dimensions, click behavior, disabled/selected/focus states, existing animation behavior, and renderer lifecycle.
- Do not modify the unrelated package-lock.json change or add dependencies.
- Publish the verified changes through the existing main/GitHub/Vercel workflow authorized by the user.

### Task 1: Device and Flux tuning defaults

**Files:** `src/lib/background-mode.ts`, `src/lib/technical-tuning.ts`, `src/components/CellsControl.tsx`, `tests/background-mode.test.cjs`, `tests/technical-tuning.test.cjs`.
**Interface:** Export `getDefaultTechnicalTuning(mode: TechnicalBackgroundMode): TechnicalTuning`; use it for initialization, sanitization, resets, SSR snapshot, and reset-button disabled state.

- [x] Update the existing tests first: fresh desktop → flux; fresh mobile → liquid; invalid/blocked desktop → flux; saved choices unchanged. Flux initial/reset/sanitization values → `{brightness:1,speed:2,response:2}`; Prism/Membrane remain `{brightness:1,speed:1,response:1}`. Verify partial saved settings inherit missing mode defaults and valid saved values remain intact.
- [x] Run targeted tests to establish expected failures.
- [x] Implement per-mode stable default objects: `const FLUX_DEFAULTS = { brightness: 1, speed: 2, response: 2 };` and `getDefaultTechnicalTuning(mode) { return mode === 'flux' ? FLUX_DEFAULTS : DEFAULT_TECHNICAL_TUNING; }`. Pass mode to the existing sanitizer. Change desktop fallback to flux, preserving hydration consistency.
- [x] Update TechnicalSliders to compare with `getDefaultTechnicalTuning(mode)`.
- [x] Run targeted tests, self-review, and commit only these files. Review spec and code before moving on.

### Task 2: Brighter blue/red palettes

**Files:** `src/lib/accent-palette.ts`, `src/app/accent-colors.css`, palette tests if expected values change.
**Interface:** Preserve existing accent fields/storage values; all current consumers continue using those fields.

- [x] Set blue text to `[111,160,255]`, fill `[47,85,245]`, onFill white, onLight `[25,53,145]`, label `Royal blue`; red text `[255,115,121]`, fill `[218,30,52]`, onFill white, onLight `[130,24,43]`, label `Neon red`. Green stays byte-for-byte identical.
- [x] Synchronize CSS accent/fill/orb colors and encoded cursor assets. Add a separate saturated glow token for each palette; use modest palette glows on the color dot and existing accent headings/navigation, without recoloring research assets or adding animation.
- [x] Retain dark readable colors on white surfaces. Run existing palette/store contrast tests and review for matching CSS/canvas colors.
- [x] Commit only the palette files. Review spec and code before moving on.

### Task 3: Liquid-glass button material and rounded edges

**Files:** Create `src/app/liquid-glass-buttons.css`; modify `src/app/layout.tsx`, `src/app/hero-controls.css`, and only tightly related existing button CSS if needed.
**Interface:** Reuse existing button classes and selected/disabled states. CSS is imported after existing site styles. No new JS effects.

- [x] Inventory hero actions/archive links, shared `.button`, footer chips, contact submit, search submit/chips, timeline/research filters, environment settings/reset, anatomy controls, and lab actions/toolbars.
- [x] Implement the shared clear material using layered low-opacity white gradients, `backdrop-filter: blur(14px) saturate(1.65)`, a bright inset top rim, darker lower rim, soft shadow, and `border-radius: 999px`. Limit mobile blur to 10px. Use dark translucent fallback when backdrop filtering is unsupported.
- [x] Give hero action/archive buttons clear neutral glass and white labels. Remove their legacy `background:none`, `box-shadow:none`, `backdrop-filter:none` overrides where they block this material. Preserve widths, spacing, hit targets, and alignment.
- [x] Apply the same optical layers to other button-shaped controls; retain existing fill colors by layering the glass background-image over existing background-color. Accent controls use `rgb(var(--accent-fill))` with `rgb(var(--on-accent))`; selected filters remain discernible. Preserve semantic danger colors. Avoid turning cards, text links, form fields, grouped navigation wrappers, or research models into pills.
- [x] Retain focus outlines, disabled states and existing transformations. Do not add perpetual animation, SVG displacement, or new GPU canvases. Verify unsupported-backdrop and reduced-motion behavior.
- [x] Run lint and inspect rendered desktop/mobile controls across all three palettes; review hover/focus/disabled/selected states and scoped changes. Commit only the button files.

### Task 4: Integrated verification and release

**Files:** Record results in `docs/FLUX_GLASS_AUDIT.md`; update this checklist and Graphify.

- [x] Run full tests, lint, production build, then standalone TypeScript and whitespace checks. Do not run build/typecheck concurrently because they share `.next/types`.
- [x] Browser: new desktop context defaults to Flux; settings show 2/2; new touch/mobile context defaults to Liquid; saved settings survive reload. Confirm reset states for all technical modes.
- [x] Inspect screenshots at 1440px and 390px across green/blue/red, and check 320px overflow/navigation. Review hero glass, contact, footer, filters, settings and standalone lab. Verify text contrast in new colored controls and light cards.
- [x] WebGL: Flux runs with the requested settings, pointer controls respond, color/settings changes retain renderers. Review the existing frame budget and GPU work, and inspect responsiveness in the software-rendered browser; preserve existing adaptive quality and pause mechanisms.
- [x] Complete whole-change review, resolve significant findings, update Graphify, and record evidence and limitations.
- [x] Prepare the verified files for release. Publication gate: fast-forward main, push, wait for CI/Vercel success, and verify the live defaults/styles; the release result is recorded in deployment status and the final response.

## Execution decisions

- Use the existing checkout on a task branch; preserve the pre-existing lockfile edit. User authorization covers implementation and push, so no additional plan or publication confirmation is needed.
- Subagent implementation/review follows the execution skill where useful; no concurrent implementation agents may edit overlapping files.
- Specialist design skill files named in AGENTS.md are absent; use a concrete scoped design and browser inspection instead of installing unrelated tooling.

- The Task 2 implementation agent became unavailable due to its usage limit. Root completed palette review and button implementation directly, with the same regression and rendered checks.
