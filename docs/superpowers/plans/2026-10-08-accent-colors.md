# Site accent colors implementation plan

> Execute inline with executing-plans; verify the complete change before publishing.

**Goal:** Add a small circular button at the far right of the navigation that cycles neon green → deep blue → deep red → green and updates all site accents without reducing text readability.

**Architecture:** One validated, persistent client store drives an HTML accent attribute. CSS uses separate readable text, deep filled-surface, on-surface text, and on-light text tokens. Existing CSS and canvas effects consume those tokens; color changes update running effects without recreating renderers.

**Tech stack:** Existing Next.js, React, CSS/SCSS, Three.js, node:test, and Playwright. No added dependencies.

**Spec:** The user's current request in this conversation.

## Constraints and review focus

- Preserve content, research assets, route behavior, and all five background interactions.
- Keep the existing unrelated package-lock.json change untouched.
- The button must remain reachable beside background settings on desktop and at the right edge on phones, including Liquid's PLAY link.
- Saved preferences apply before paint, survive navigation/reload, and synchronize between tabs; blocked or invalid storage defaults safely.
- Deep blue/red fills need light foregrounds. Accent text on dark glass needs lighter blue/red; light cards need darker text.
- Cursor trails, hovered characters, Cells, and decorative anatomical tint must update instantly without renderer or asset churn.
- Check public indexes, detail pages, contact/search forms, footer, home lab, standalone lab, and play mode on desktop and phone widths.

## Task 1: Persistent palette and navigation control

- [x] Add src/lib/accent-color.ts and tests/accent-color.test.cjs covering default/invalid/blocked storage, cycling, HTML application, and external storage changes.
- [x] Add src/components/AccentColorControl.tsx using an accessible native button with a 44px hit target and a small current-color dot.
- [x] Insert at the far right of Navigation.tsx, and restore data-accent in the existing early layout script before paint.
- [x] Add src/app/accent-colors.css with palette roles and button styles; widen the desktop navigation by the button's occupied space and keep mobile controls within the viewport.

## Task 2: Complete token audit and live effects

- [x] Replace hardcoded neon-green CSS and inline colors with palette tokens, including footer, hero, navigation, technical fallbacks, play mode, and animated effects.
- [x] Map opaque accent fills and on-accent text to the deep-fill pair; add a readable on-light role for frosted content.
- [x] Update CursorField/CursorTrail, HeroNameHover, and VantaCells in place on accent changes.
- [x] Recolor the decorative hero body tint in its shader without altering model assets or anatomical data.
- [x] Audit remaining green literals and document any research/physical-material colors that retain their factual meaning.

## Task 3: Verification and publication

- [x] Run lint, typecheck, full tests, production build, and diff checks.
- [x] Inspect rendered desktop/mobile green, blue, and red, including footer and light cards.
- [x] Verify keyboard/touch cycling, contrast role pairs, saved choices, cross-tab synchronization, hydration, all public routes/details, and every background.
- [x] Update Graphify, complete an independent review, resolve significant findings, and record results in docs/ACCENT_COLOR_AUDIT.md.
- [ ] Commit only feature files, push through the existing authorized GitHub/Vercel workflow, and verify the exact production commit and live UI. This final release step follows the recorded pre-publication audit; its result is available in GitHub/Vercel deployment status.

## Execution notes

Native execution continues in the existing user-authorized workspace/branch. Plan handoff confirmation is omitted because the user has instructed implementation and the session's autonomy instructions require continuing authorized work. Browser helpers are adapted to the project's existing JavaScript Playwright and isolated database harness.
