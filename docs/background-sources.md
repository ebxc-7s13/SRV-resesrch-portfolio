# Background system sources

The site backdrop (`src/components/background/`) is original code written for
this portfolio. No shader, component, or background implementation was copied
from any external repository. This file records the dependencies and the
public techniques that informed the design, per the project spec.

## Dependencies (all permissive licenses)

| Source | Repository | License | What is used | Where |
| --- | --- | --- | --- | --- |
| three | https://github.com/mrdoob/three.js | MIT | WebGL renderer, orthographic camera, fullscreen shader quad, `ShaderMaterial`, `Points` for the sparse particle layer | `src/components/background/FluidCanvas.tsx` (already in `package.json`) |
| @react-three/fiber | https://github.com/pmndrs/react-three-fiber | MIT | Single `Canvas` host, `useFrame` render loop, `ShaderMaterial` wiring for the fluid + particle passes | `src/components/background/FluidCanvas.tsx` |
| @react-three/drei | https://github.com/pmndrs/drei | MIT | `AdaptiveDpr` + `PerformanceMonitor` for automatic quality step-down only | `src/components/background/FluidCanvas.tsx` |
| Next.js dynamic import | https://github.com/vercel/next.js | MIT | Streams `FluidCanvas` + WebGL after first paint (idle callback) so the backdrop never taxes initial load | `src/components/background/BackgroundSystem.tsx` |

No `@react-three/postprocessing` (`EffectComposer`) or GSAP code is used by
the background system. Scroll response is read from the shared
`src/lib/interaction.ts` pointer/scroll store, not from ScrollTrigger. (The
3D laboratory is a separate, untouched system.)

## Technique references (concepts studied, code not copied)

| Source | License | What was adapted | Where it is used |
| --- | --- | --- | --- |
| Inigo Quiles — "Painting with Maths" / domain-warping articles (iquilezles.org) | Public articles, original GLSL written here | The idea of domain-warped value-noise fbm (`fbm(p + fbm(p + fbm(p)))`) and ridged `1 - abs(2x-1)` filament bands | `FLUID_FRAGMENT` in `FluidCanvas.tsx` — hash/noise/fbm functions are hand-written value noise, not copied |
| Three.js fullscreen-pass examples (three.js repo, examples/jsm) | MIT | One fullscreen pass (2×2 plane mesh, depth test/write off) instead of scene geometry | Fluid mesh in `FluidCanvas.tsx` |

## Deliberately NOT used

- No Navier-Stokes / stable-fluids solver: the spec calls for fluid
  *appearance* via shader approximation, which is what ships.
- No postprocessing chain: vignette, grain, and glow are computed in-shader,
  so there is no `EffectComposer` cost.
- No starfield / galaxy / stock particle demo: particles are a sparse
  secondary layer (180/92/24 by high/medium/low quality, 0-trail on low)
  over the procedural fluid body.

## Attribution notes

- three.js, @react-three/fiber, and @react-three/drei are MIT licensed and
  ship via npm with their LICENSE files intact — no further action needed.
- No other third-party background code is present, so no additional
  attribution blocks are required.
