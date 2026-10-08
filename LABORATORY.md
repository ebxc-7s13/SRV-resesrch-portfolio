# Research laboratory

The incremental laboratory experience lives at `/lab`. The existing portfolio, research pages, CMS, authentication, database schema and API routes remain in place. `Navigation` links to the laboratory; `PortfolioFrame` gives this route its own presentation without mounting the original ambient effects.

## Research content and identities

`src/lib/lab-devices.ts` contains asset URLs, display transforms, camera limits and verified content identities. It does not contain copies of research descriptions.

| Device | Existing project seed identity | Patent seed identity |
| --- | --- | --- |
| Microgravity Simulator | `microgravity-platform` | Automated Multi-Modal Microgravity-on-a-Chip Simulation Platform |
| Microscope | `oncospectrix-microscope` | Label-free Autofluorescence Imaging Device & AI-based Screening Method for Oral Cancer |

`src/lib/lab-content.ts` reads the existing PostgreSQL tables on the server. It resolves project and patent identities through `seed_records`, falling back to the verified original slugs/titles for installations without that table. Project links use the current database slug, so CMS changes remain visible. Only explicit public fields cross into the client. The first existing hardware image, or first other project image, supplies the wall illustration.

Research panels omit empty sections. They display the stored research problem, motivation, approach, methodology, hardware, experimental setup, data acquisition, computational method, results and contribution. Patent associations are supported by the original project/patent records. No explicit project-to-publication relation exists in the repository, so the device panels say that no associated publications are listed. The publication wall and HTML library show actual publication records without inferring that either paper reports the simulator experiment.

`CONTENT_CONFIRMATION.md` remains applicable. Status and scientific claims come from the existing records; their inclusion does not resolve the documented confirmation questions. The supplied microscope is linked to the imaging research without claiming that its geometry is an exact OncoSpectrix prototype model.

## Supplied source inspection

Originals are preserved under `source-assets/research-devices/`, outside `public/` and excluded from version control. The source files supplied in Downloads were not changed. `scripts/models/manifest.json` records hashes, source bounds, materials, transforms and output counts.

| Source | Geometry and structure | Attributes and dependencies |
| --- | --- | --- |
| `MMSAmodel.obj` | 31,442,897 bytes; 389,568 vertices; 779,396 triangular faces; one object `geometry_0`; no groups; one index-connected component | No supplied normals, UVs, materials, MTL references or texture references. No invalid indices or repeated-index faces were found. |
| `microscope.zip` → `Microscope N180608.3ds` | The archive contains 3DS and GSM files, **not OBJ**. The imported 3DS has one mesh `Layer_dia-`, 5,098 vertices and 4,046 triangles. | Embedded diffuse material `Material`, color `#e1e1e1`, opacity 1; UVs present; no referenced textures. Normals are derived by the 3DS importer. The original archive and accompanying files are preserved. |

The archive's text credits Archibase Collection / PS3D and supplies website references. It contains no explicit license terms. No additional authorship or licensing claims have been assigned.

MMSA source bounds are approximately `[-1.000414, -0.764175, -0.670385]` to `[0.995700, 0.758000, 0.665889]`, with dimensions `[1.996114, 1.522176, 1.336273]` in unspecified source units. Its support feet establish Y-up. The microscope source dimensions are `[0.732678, 1.016473, 1.534950]`; its base and eyepieces establish Z-up, corrected with a −90° X rotation.

Neither source establishes physical measurement units. Each export has its longest extent normalized to one display unit, X/Z centered and base at Y=0. Scene scales are presentation dimensions, not manufactured dimensions. MMSA uses scale 1.85; the microscope uses 0.86, both on bench height 1.14. These stable transforms are in the device configuration.

## Recoverable conversion workflow

From the repository root, after `npm ci`:

```sh
npm run models:inspect
# Optional orthographic source inspection; requires Python, NumPy and Pillow:
python scripts/models/projections.py
npm run models:convert
npm run models:validate
```

1. Restore originals to the documented `source-assets` paths if working in a fresh checkout. Do not place raw OBJ/3DS/ZIP files in `public`.
2. `inspect.mjs` counts actual geometry and records bounds, materials, attributes and dependencies. Its indexed OBJ reader is deliberately restricted to this source's supported structure: it rejects unexpected normals, UVs, materials, groups or multiple objects rather than silently discarding them. Future textured/multipart OBJ sources need a suitable importer and preservation checks.
3. Inspect source projections and the imported model. Do not infer orientation, units or component functions from the filename. The present sources required orientation/normal handling, not aesthetic geometry reconstruction.
4. `convert.mjs` uses Three's GLTF exporter and glTF Transform. It derives missing normals, preserves microscope diffuse color/opacity, and assigns MMSA one neutral presentation material. It does not guess material types for individual mechanical parts.
5. Normalize the root transform. Deduplicate/weld equivalent data. High retains the source triangle count. Medium/low simplify with bounded geometric error and locked boundaries; they are presentation tiers, not engineering replacements.
6. Apply meshopt compression with 16-bit position, 12-bit normal and 14-bit UV quantization. Export GLB, decode it again and record actual counts/bytes.
7. Validate each output's decoded bounds, finite normals, triangle counts and absence of public raw sources. Inspect **all tiers in the browser**, including silhouette, feet/base, thin parts and gears. Compare with High before accepting a reduced tier.
8. Capture static previews from the actual rendered models using `/lab/models`. The committed WebP previews are renders of these supplied assets, not generated equipment substitutes. Capture the actual room through development clean-scene mode for its poster.

| Runtime asset | Bytes | Triangles | Loading policy |
| --- | ---: | ---: | --- |
| `public/3d/microscopes/microscope.glb` | 35,244 | 4,046 | First nearby device after entering; same small asset for every tier |
| `public/3d/microgravity/mmsa-medium.glb` | 1,052,560 | 272,788 | Entering the engineering bay or inspecting at Medium |
| `public/3d/microgravity/mmsa.glb` | 2,470,636 | 779,396 | Explicit High-quality inspection only |
| `public/3d/microgravity/mmsa-low.glb` | 332,984 | 77,938 | Low-quality engineering bay and inspection |

Static previews live beside each device, and the room poster is `public/3d/environment/laboratory.webp`. No raw model is requested by the browser.

## Reusable scene and controls

- `ResearchDevice.tsx`: common loading, isolated asset failure, model cloning, material highlights, bounds/axes, device selection and local decoder configuration.
- `LabScene.tsx`: controlled station cameras, bounded orbit/zoom, common benches and workstation elements, existing research images and publication wall. Environmental instrumentation contains no invented experimental measurements.
- `LabExperience.tsx`: HTML device directory, record panels, station controls, motion/quality controls and WebGL fallback.
- `ModelReview.tsx` and `/lab/models`: development-only standalone model preview; the route returns 404 in production.
- `LabDiagnostics.tsx`: development-only local resource timing display. No telemetry is transmitted.

To add a device: inspect/convert its supplied source, add its verified content mapping and transform in `lab-devices.ts`, extend the device ID type, provide an HTML entry/preview, and compose a station from the existing environment helpers. Add content relationships only when the database/source supports them. Reuse `ResearchDevice`; device-specific code should not duplicate research descriptions or interaction handling.

## Performance, accessibility and production

Initial HTML includes real research entry points and static previews. Three/Fiber and GLBs mount only after entering a station. The room renders before model completion; MMSA is deferred until its bay is visited. Desktop defaults to Medium because CPU count does not prove GPU capacity; small/coarse-pointer or low-memory devices default to Low. High is an explicit selection.

Pixel ratio caps are High 1.75, Medium 1.25 and Low 1. Low disables shadows, anti-aliasing and the extra workstation lights. There is no post-processing or automatic rotation. Rendering is demand-driven and paused when offscreen or the tab is hidden. Loaded model tiers remain cached for subsequent inspection; High retains substantially more GPU geometry than Low. Mobile viewport testing does not establish frame rate or thermal behavior on every physical device.

The HTML directory and original research/publication pages remain usable without WebGL. Controls support keyboard rotation/zoom, Escape/close and Return to lab. Device selection focuses the research heading; returning focuses the return control. System reduced motion and the existing saved pause preference disable camera animation. Mobile stacks the panel below the scene.

The application still runs Next.js/Node with PostgreSQL; no new database tables or API routes are required. Deploy optimized `public/3d` assets with the application, not source originals or `.qa` evidence. GLBs use a one-hour cache with revalidation; use versioned URLs if extending that lifetime.

Production CSP permits WebAssembly compilation **only on `/lab` and its subpaths** for the locally bundled meshopt decoder. Entering and leaving the lab uses ordinary document navigation, so the appropriate CSP is actually applied rather than inherited across a client-side route transition. It does not enable JavaScript eval or external script/decoder origins. Existing authentication, TLS, proxy, CSRF/origin, upload and other security behavior remains covered by the regression suite. Next header precedence and the narrower Wasm directive are documented by [Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers) and [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src).

Development mode `/lab?debug=1` exposes axes, bounds, origin, rotation, scale, target, hierarchy, loading states, model network timing, clean capture, animated-transition preview and an actual `WEBGL_lose_context` test. Debug overlays and test controls are disabled in production.

## Validation

Run `npm test`, `npm run models:validate`, `npm run lint`, `npx tsc --noEmit --incremental false`, and `npm run build`. Also inspect the production browser: its CSP differs from development. Test initial/no-GLB loading, both source models, every MMSA tier, selection/orbit/zoom/return, the correct project records, publication wall, 2D mode, narrow viewport, system reduced motion, actual context loss and recovery. Check browser errors and model transfer sizes.

Local validation outcomes are recorded in `LABORATORY_VALIDATION.md`.
