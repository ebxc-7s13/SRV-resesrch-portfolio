# Homepage anatomy replacement - 2026-10-07

The homepage model now uses a shared-coordinate Z-Anatomy body with separately
cached skeleton, muscle and nervous packs. Full skin with fitted shorts is the resting state.
Selecting a system changes the pointer inspection window; it does not replace
the entire skin surface. Camera constants, rotation and click-to-face/body zoom
remain unchanged. This is an anatomical illustration, not a complete atlas.

## Source and licensing

1. **Exact source downloaded first:** the full official
   [Z-Anatomy.zip](https://github.com/Z-Anatomy/Models-of-human-anatomy/raw/master/Z-Anatomy.zip),
   86,734,957 bytes; SHA-256
   `e029688545627bd0214b269e1063143abb580aad72b2c2445d6d8a9a0d9da736`.
   ZIP CRC verification passed. `Z-Anatomy/Startup.blend` is 306,838,281 bytes.
   Archives/extraction stay in ignored `.qa/z-anatomy/`, outside browser assets.
2. **Exact systems:** 242 skin-region meshes plus four eye surfaces; 308
   skeletal objects, including teeth and axial cartilage; 509 muscles/tendons;
   202 spinal/peripheral/autonomic nerve structures plus six eye structures.
   The nervous pack also contains the licensed original Brain for Blender pial
   cortex and explicitly recorded schematic brainstem/optic connections.
   Exact object names are in `public/models/anatomy/source-selection.json`.
3. **License assessment:** derived assets/scripts CC BY-SA 4.0; preserve the
   required Z-Anatomy and historical BodyParts3D CC BY-SA 2.1 Japan credits.
   The cortex is Anderson M. Winkler's official CC BY-SA 3.0 source, adapted
   under CC BY-SA 4.0. Unverified original brain/cranial nerve meshes, inner ear,
   auditory ossicles, kidneys and viscera are excluded. See
   [license audit](z-anatomy-license-audit.md) and the existing model credit
   link, now pointing to `public/models/anatomy/ATTRIBUTION.md`. No new legal
   page or broader website license change was introduced.
4. **Files created:** eight GLBs, `preview.webp`, `decoder-worker.js`,
   `meshopt-decoder.js`, `MESHOPT-LICENSE.txt`, `ATTRIBUTION.md`,
   `source-selection.json`, `brain-source.json`, `reconstructions.json`,
   `anatomy-meta.json`; offline scripts/README under
   `scripts/models/z-anatomy/`; this report, license audit and implementation plan.
5. **Old files removed:** the confirmed-unused `public/3d/xray/` assets,
   `humanSkin.ts` and five legacy homepage conversion scripts, after replacement
   validation. Recoverable copies and an exact removal manifest remain locally
   under `.qa/z-anatomy/baseline/`. Unrelated laboratory models are retained.

## Asset costs and loading

6. **Final GLBs:** byte counts below are uncompressed HTTP file sizes; HTTP
   compression/cache can reduce actual transfer further.

| Pack | Standard bytes | Reduced bytes | Standard triangles | Reduced triangles |
| --- | ---: | ---: | ---: | ---: |
| Body with shorts | 222,896 | 99,868 | 50,287 | 20,785 |
| Skeleton | 609,932 | 259,224 | 144,942 | 59,968 |
| Muscles | 783,344 | 339,780 | 179,800 | 74,934 |
| Nervous | 759,628 | 371,796 | 179,848 | 84,934 |

All eight GLBs total 3,446,468 bytes. A visitor uses one tier, not both.
The clothed preview is 10,844 bytes.

7. **Compression:** required `EXT_meshopt_compression`, high level;
   quantized positions/normals/colors. A same-origin JavaScript decoder worker
   preserves existing CSP without WASM/eval permission changes. No texture
   downloads are needed for these vertex-colored/material-based packs.
8. **Geometry optimization:** source allowlists; helper/hidden layer removal;
   soft nasal cartilage removed from bones; irrelevant muscle cross-references
   removed from nerves; opaque cornea/lens overlap removed; source modifiers
   evaluated, surface thickness/internal faces removed, curves bounded,
   duplicate vertices welded, normals recalculated, deduplication/pruning,
   simplification and one mesh/primitive per pack. Every system uses the same
   Y-up, anterior +Z transform and source-derived two-unit body volume.
9. **Loading:** client-only lazy scene import; body first; desktop skeleton
   deferred three seconds while visible; muscles/nerves on intent. Reduced
   devices defer all internal packs. One loader, decoder, renderer, scene,
   camera and rigid rotating root. Promise/object caches prevent repeat fetch
   and parse on hover/switch. Offscreen/document-hidden work pauses without
   unmounting the viewer. Route unmount disposes owned resources.
10. **Initial payload:** old standard model/details/textures totaled 2,270,580
    bytes; the new initial clothed body is 222,896 bytes (about 90% smaller), or 99,868
    on reduced devices, plus preview/decoder. Observed compressed clothed-body
    transfer was 178,183 bytes including HTTP overhead before final provenance
    metadata (+680 file bytes) was added. The successful Next
    production build reported homepage First Load JS 209 kB, route 11.3 kB.
    Same-tool standalone scene bundles: old 160,594 gzip bytes; new 160,672
    (+78 bytes). This comparison includes Three.js; it is not an exact
    before/after Next route-chunk comparison, which was not recorded.

## Interaction and verification

11. **Skeleton:** hover/select loads or chooses the skeletal pack; pointer over
    the body reveals only that pack within the original feathered window.
    The skull has a nasal opening, not soft nasal cartilage. Actual bony nasal
    structures remain. Leaving the body restores complete skin.
12. **Muscles:** the same window reveals aligned muscles/tendons using a
    restrained warm material. It never displays the entire pack over opaque skin.
13. **Nerves:** reveals the cortex, eyes, spinal cord and peripheral/autonomic
    network. Colored iris/retinal surfaces preserve eye contrast; overlapping
    opaque lens/cornea surfaces are excluded. Optic/brainstem connections are
    schematic; unverified cranial branches remain absent. No claim of a
    complete diagnostic nervous system is made.
14. **Face zoom:** actual browser click verified zoom reaches 6.500 and target
    Y 1.8400. Original face target `max.y - height * .08` and damping remain.
15. **Body zoom:** the next click returns zoom 1.000 and target Y 1.0000.
16. **Rotation:** successive browser samples changed rotation while active.
    All layers inherit the same root, at the original .42 radians/second.
    There are no independently rotating systems or new orbit/drag controls.
17. **Desktop:** actual local homepage and isolated viewer were inspected in
    Brave. Body, skull/teeth/nasal opening, chest muscles, cortex and eyes
    rendered. Controls match the smoked emerald/neon-green hero language.
    Protected hero/navigation/Vanta/typography/CTA source hashes remained equal.
18. **Mobile:** 390 x 844 browser viewport checked; initial fetch/parse count
    was one, 83,688 bytes. Controls were legible/reachable; reduced nerves,
    skeleton and muscles loaded on intent. Existing compact illustration slot
    remains behind hero content; its silhouette is deliberately subdued.
    A physical touch device/GPU was not available; touch-center reveal is
    implemented but not claimed as hardware-tested.
19. **Keyboard:** focus selects/reveals a central inspection window;
    Enter/Space selects; Escape clears inspection and restores the default
    selection. Canvas click/Enter/Space toggles face/body zoom. Visible focus
    rings, labels, selected state, loading state and live status are present.
20. **Reduced motion:** the actual scene controller was run with reduced
    motion; rotation remained 0.0000 across interactions, camera changes snapped,
    system visibility worked, and continuous RAF stopped when settled.
    CSS and the live `prefers-reduced-motion` listener are retained. An actual
    operating-system media preference switch was not emulated.
21. **Console:** final viewer checks reported no shader/WebGL/decoder errors.
    Stress testing found and fixed an overly aggressive slow-frame poster
    fallback; it now lowers DPR/cadence while retaining interactivity. A
    separate production homepage attempt was not a valid release runtime test:
    simultaneous dev/build output caused a `.next` collision, and its separate
    database connection was restricted. A clean build passed after allowing
    the existing font downloads; its output was archived outside the dev cache,
    and a fresh homepage recovered. The anatomy fixture ran under production
    CSP without shader/decoder errors. Browser-extension channel errors were
    recorded separately during earlier fixture sessions; the final fresh
    homepage console check returned no warnings/errors.
22. **Network/cache:** 21 repeated homepage selections held four GLB fetches
    and four parses, with one canvas. The base remains visible during first
    system loading. Fixture Resource Timing records each pack once; cached
    switches add no pack request. No browser request loads ZIP/Blender sources.
23. **Memory/performance:** one resting draw call; two at a settled reveal;
    brief crossfades can use three/four. Geometry allocations remain bounded
    by four cached packs. Decoded attributes/indices total about 9.15 MB for
    all standard packs or 2.70 MB reduced, excluding driver/renderer overhead.
    Fixture foreground cadence sampled 33.3 ms, submit time .2-1.7 ms;
    homepage samples varied around 41-45 ms; final automation-session samples
    were 90-127 ms despite .1-.2 ms renderer submission time. These are global
    browser frame intervals, not GPU timings, and do not establish a universal
    no-stutter acceptance result. Heap samples fluctuated with GC rather than
    proving a formal leak-free heap profile. No unconditional zero-lag claim
    is made across devices. DPR caps 1.5/1.25, adaptive .75; no post-processing
    or extra WebGL background. Viewer telemetry is throttled while rotating.

## Change scope and checks

24. **Exact source changes:** `src/components/xray/createXrayScene.ts`,
    `XrayHero.tsx`, `XrayHero.module.css`, `meshoptWorker.ts`,
    `vendor/README.md`; new model scripts `inspect-source.py`, `select.py`,
    `extract.py`, `prepare-brain.py`, `add-brain.mjs`, `optimize.mjs`, `poster.py`,
    `validate.mjs`, `README.md`; the three anatomy documentation files.
    Required Graphify AST refresh updated its graph/report/manifest, label
    signatures and caches (11,025 nodes, 18,518 edges, 749 communities).
25. **Exact asset removal record:** `.qa/z-anatomy/removed-files.json` lists
    every deleted path. Old model assets were backed up before removal.
    Temporary human/anatomy browser review HTML/JS files were removed from
    public. Raw source archives/extractions are ignored and never runtime files.
26. **Git status:** branch `codex/homepage-xray-hero`; pre-existing extensive
    staged/untracked changes are preserved. The anatomy additions are untracked
    in the existing workspace; no commit, push or deployment was requested.
    Exact final status is saved at `.qa/z-anatomy/git-status-final.txt`.

Checks: TypeScript and scoped ESLint passed; 19/19 existing tests passed;
all eight GLBs decoded and passed common-bounds, counts, compression, license
exclusion, soft-nose exclusion, eye inclusion and payload checks. Production
build passed. Local evidence is retained in `.qa/z-anatomy/`.

Reproduction: [offline conversion instructions](../scripts/models/z-anatomy/README.md).
