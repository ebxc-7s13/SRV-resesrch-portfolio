# 3D asset record

Authored biomedical R&D facility. Runtime loads optimized GLB only. Originals stay in `source-assets/` (git-ignored), never in `public/`.

## Real research assets (do not fictionalize)

| Asset | Runtime | Source | License / provenance | Modifications | Used where |
| --- | --- | --- | --- | --- | --- |
| Microscope | `public/3d/microscopes/microscope.glb` 35,244B 4,046 tris | `source-assets/research-devices/microscope/Microscope N180608.3ds` (5,098 verts, 4,046 tris, embedded `#e1e1e1` diffuse, UVs, no textures) from `microscope.zip` | Supplied by researcher. Archive text credits Archibase Collection / PS3D, no explicit license terms shipped. Treated as researcher-supplied, not redistributable beyond this portfolio. | Z-up → Y-up (-90° X), longest extent normalized to 1, base Y=0, missing normals derived, meshopt 16/12/14-bit, GLB. No geometry restyle. | ZONE 1 Biomedical Imaging bench, scale 0.86 |
| MMSA microgravity simulator | `public/3d/microgravity/mmsa.glb` 2,470,636B 779k tris (High) / `mmsa-medium.glb` 1,052,560B 272k tris / `mmsa-low.glb` 332,984B 77k tris | `source-assets/research-devices/mmsa/MMSAmodel.obj` 31MB 389k verts 779k faces, single object `geometry_0`, no normals/UVs/materials | Supplied by researcher, actual prototype geometry. Units unspecified. | Y-up kept (feet define up), centered X/Z, base Y=0, normalized to 1, normals derived, one neutral presentation material, tiered simplify with locked boundaries + meshopt. No part invention. | ZONE 2 Microgravity bay platform, scale 1.85 |
| Room + device previews | `public/3d/environment/laboratory.webp`, `public/3d/*/preview.webp` | Rendered from actual GLBs via `/lab/models` + clean-scene capture | Generated, no third-party rights | WebP only | Lab cover, device cards |

Pipeline: `npm run models:inspect` → optional `python scripts/models/projections.py` → `npm run models:convert` → `npm run models:validate`. Manifest: `scripts/models/manifest.json`. See `LABORATORY.md`.

## Code-built modular kit (no external rights)

Benches, shelving, ceiling battens, wall panels, skirting, cable trays, stools, bins, paper stacks, binders, sample vials, keyboards — built in `ScenePrimitives.tsx` / `FacilityDetails.tsx` / `LabScene.tsx` from boxes/cylinders/tubes with distinct PBR parameters per surface. These are architectural joinery, not hero devices, so primitives composed with trim + edge + material variation are the correct representation (per brief PHASE 42: small props / joinery may be modular).

## External free assets — shortlist, none bundled yet

No external models are bundled in this pass. When generic props are needed, prefer in this order:

1. Kenney — CC0, `https://kenney.nl/assets` (lab furniture pack if available)
2. Poly Pizza — CC0, `https://poly.pizza` (search lab / office / electronics)
3. Sketchfab free downloadable — check per-model license (prefer CC0, else CC-BY with attribution row added here)
4. Open-source GitHub asset repos with explicit LICENSE

Rules: only CC0 or CC-BY with attribution stored here + credits/about area; no ripped/paid/unclear-license models; one coherent set, not a random assortment; GLB-optimized, versioned URL, size budget (<500kB per prop, <2.5MB hero High only).

## Screens / print (no 3D rights issue)

Monitor/projector/poster content comes from existing `project_media` (`public/research/*`) and canvas-generated technical labels. Monitors and the projector render image textures live (dimmed at rest, full on approach); video plays only at the active station. No fabricated results. Status labels reproduce source records.
