# Fitted shorts on the homepage body

The default Z-Anatomy body now wears actual Cortu Johnstone jeans-shorts geometry from the official MakeHuman pants01 CC0 pack. This is an adapted external garment, not boxes or a painted rectangle. Its waist, fly, seat and two thigh openings were calibrated to the existing body. The cloth uses source diffuse values baked into muted emerald vertex colors.

Source, archive/object/file hashes, license evidence and calibrated landmarks: `public/models/anatomy/shorts-source.json`. Licensing discrepancy in the old OBJ exporter header is documented in `docs/z-anatomy-license-audit.md`; the author headers and official asset listing explicitly release the clothing under CC0. The existing anatomical attribution includes the clothing source. The 20.9 MB source pack stays in ignored `.qa/`, outside runtime.

## Asset impact

| Tier | Clothed body | Increase | Body + garment triangles | Decoded geometry bytes | Resting draw calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| Standard | 222,896 B | 41,996 B | 50,287 | 607,146 | 1 |
| Mobile | 99,868 B | 16,180 B | 20,785 | 253,122 | 1 |

The fitted garment adds 8,288 triangles on desktop and 2,786 on the reduced tier. Both versions are welded/compressed with Meshopt after the existing body simplification. The raw body buffers remain unchanged, so rebuilding never stacks duplicate shorts. No new texture, runtime JS, material, canvas, loader or initial request is introduced. The anatomy packs remain separate and cached.

## Verification

All eight GLBs decoded and passed the existing source/alignment/payload validation. Offline front, side and back views were inspected during fitting; the first intersecting attempt was corrected before integration. Live renderer checks verified skin/shorts at rest, skeleton/muscle/nerve inspection through the garment, four downloads/parses total after repeated switching, one resting draw and two inspection draws. The face zoom reached 6.5 with target Y 1.84 and returned to body zoom 1 with target Y 1.0. Reduced motion stopped rotation while keeping inspection. No console warning/error came from the standalone anatomical renderer.

The hero, typography, navigation, Vanta, CTA components and page/layout files match their original protected hashes. Viewer/camera/control source code was not edited for this clothing change. The current site may still have the previously documented device-dependent frame cadence; no new zero-lag guarantee is made.

Files added: `scripts/models/z-anatomy/fit-shorts.py`, `public/models/anatomy/shorts-source.json`, this report. Updated: base standard/mobile GLBs, anatomical poster/metadata/attribution; offline optimizer/poster/reproduction instructions; license audit and existing anatomy report. No old or unrelated model assets were deleted for this task.

The fresh production build completed successfully: homepage route 11.3 kB, First Load JS 209 kB, unchanged from the previous build. Actual styled homepage desktop rendering of the final 222,896-byte body was confirmed; evidence is in ignored `.qa/z-anatomy/shorts-home-desktop.png` and `.json` (one anatomical canvas, one resting draw, base/skeleton loaded).

Mobile GLB decode and payload checks passed, but the final full-homepage mobile browser check was **not completed**: shared Next generated files were overwritten, an isolated production preview correctly rejected the local development database, and the subsequently active preview stopped responding to browser navigation. No database guard, browser protection or unrelated application code was changed to bypass those failures. The reduced garment uses the same fitted shape with fewer triangles; full mobile browser QA remains a limitation. Standalone model console logs were clear; transient preview/server failures are separate from the clothing asset.

Git remains on `codex/homepage-xray-hero` with extensive pre-existing changes. Task files were left for review; no commit/reset or unrelated cleanup was performed. Detailed status is saved in ignored `.qa/z-anatomy/shorts-git-status.txt`. Temporary browser-review files were removed from `public/`.
