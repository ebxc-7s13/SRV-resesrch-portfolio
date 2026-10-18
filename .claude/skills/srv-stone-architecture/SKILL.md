---
name: srv-stone-architecture
description: Rules for the SRV portfolio's Stone Mode (/stone/*) — the monochromatic Greek limestone variant of the site. Use when changing anything under src/app/stone, src/components/stone, src/lib/stone-mode.ts, the stone material in the 3D lab or anatomy hero, or when adding a page that needs a stone counterpart.
---

# SRV Stone Architecture

Stone Mode is the same portfolio carved into one pale, cool-grey limestone.
It is a *variant*, not a fork: every stone route re-exports the original page,
and all stone styling is scoped so the original site can never change.

## Architecture (do not break)

- Routes: `src/app/stone/**/page.tsx` re-export the original pages. Add a stone
  counterpart for every new public page and register it in `STONE_ROUTES`
  (`src/lib/stone-mode.ts`). Admin, `/play` and the dev-only `/lab/models` have
  no stone counterpart on purpose.
- Scope: every stone selector starts with `:root[data-stone]`. The attribute is
  set before paint by the root layout bootstrap script and kept in sync by
  `PortfolioFrame`. Never style stone through un-scoped selectors.
- CSS lives in `src/app/stone/stone.css` (loaded only by the stone layout).
  The only global stone CSS is `src/app/stone-key.css` (activation feedback and
  the entry veil), which is inert outside its own elements.
- Links: `StoneShell` rewrites internal anchors to their `/stone` counterpart
  (DOM `href` for hover/copy, click capture for Next `<Link>`). Routes without a
  counterpart keep their original destination.
- Exits: the fixed "Return to original portfolio" control, browser back, and a
  triple press on the About-page SRV mark. Never make the triple press the only
  way out.

## Material system

- One stone family. Tokens: `--stone-highlight … --stone-deep`, `--stone-text`,
  `--stone-muted`, `--stone-border`, `--stone-focus`. No hue anywhere: no
  accents, no coloured glows/gradients/shadows, no pure #000/#fff surfaces.
- Light comes from the upper left everywhere (text, bevels, grooves, 3D key
  light). Raised: highlight top-left, shadow bottom-right. Incised: reversed.
- Surfaces: solid limestone (page), raised plaque (cards, primary buttons),
  recessed channel (inputs, selected tabs, code), engraved line (dividers,
  tables), sculpted relief (hero, lab entrance). Use the shared shadow tokens
  (`--relief-raised`, `--relief-recessed`, `--engrave-line`), not ad-hoc ones.
- Grain: the two shared SVG tiles in `public/stone/` only, as low-opacity
  backgrounds. Never add per-component SVG filters.
- Greek references (meander frieze, fluting, inscription panels) are used
  sparingly: the frieze under the navigation and above the footer, the hero
  inscription. No columns, temples or stock imagery.

## Typography

- Display: Cinzel (lapidary capitals) for the hero and headings; body: EB
  Garamond. Text stays real, selectable HTML. Relief comes from 1px
  highlight/shadow pairs; never stack blurry shadows.
- Contrast is checked on the actual stone values: body/muted ≥ 4.5:1, large
  headings ≥ 3:1. Relief never substitutes for contrast.

## 3D

- Never change geometry, hierarchy, transforms, cameras, controls or tours.
- Lab (`StoneMaterials.tsx`): per-mesh *clones* of each original material with
  a shader patch that maps the final diffuse colour (maps, vertex and instance
  colours included) to the stone luminance ramp, removes metalness/hue from
  emissive and adds object-space grain. Originals are restored on unmount;
  clones are disposed. Screens keep their images, desaturated, unlit.
- Anatomy hero: `createXrayScene` takes `stone: true` and swaps its palette;
  the shader tint is disabled.

## Performance and accessibility

- No extra WebGL scenes, post-processing passes or large textures for Stone
  Mode. The chisel cursor is a CSS cursor (SVG with PNG fallback) for fine
  pointers only; text fields keep the I-beam.
- Respect `prefers-reduced-motion` (no veil animation), keep visible focus
  (`--stone-focus` carved outline), never rely on tone alone for state —
  selected/active items also change relief or weight.

## Testing

- `tests/stone-mode.test.cjs`: route mapping, triple-press state machine,
  scoping (every stone.css rule under `:root[data-stone]`), stone route
  coverage.
- Before finishing: lint, typecheck, `npm test`, production build, and a
  browser pass over every stone route plus the original routes (they must look
  unchanged), the triple press (1, 2, timeout, 3), the return control, the lab
  in both modes.
