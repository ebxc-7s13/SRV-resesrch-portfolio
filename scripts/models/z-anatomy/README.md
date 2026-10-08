# Offline anatomy conversion

The conversion scripts and derived assets are CC BY-SA 4.0. Preserve
`public/models/anatomy/ATTRIBUTION.md`; read `docs/z-anatomy-license-audit.md`
before changing the source allowlist.

Download the complete official archive FIRST from
`https://github.com/Z-Anatomy/Models-of-human-anatomy/raw/master/Z-Anatomy.zip`
to `.qa/z-anatomy/source/Z-Anatomy.zip`. Verify ZIP CRCs and the SHA-256 recorded
in `source-selection.json`. Extract only under `.qa/z-anatomy/source/extracted/`.
Use official Blender 4.5 with embedded script execution disabled:

```powershell
$blender = '.qa/z-anatomy/tools/blender-4.5.0-windows-x64/blender.exe'
$source = '.qa/z-anatomy/source/extracted/Z-Anatomy/Startup.blend'
& $blender --background --factory-startup --disable-autoexec --python scripts/models/z-anatomy/inspect-source.py -- $source .qa/z-anatomy/inspection.json
python scripts/models/z-anatomy/select.py .qa/z-anatomy/inspection.json public/models/anatomy/source-selection.json
& $blender --background --factory-startup --disable-autoexec --python scripts/models/z-anatomy/extract.py -- $source public/models/anatomy/source-selection.json .qa/z-anatomy/raw
```

Download the original licensed Brain for Blender pial archive to
`.qa/z-anatomy/source/brainder-pial.tar.bz2`, using the URL/hash/license in
`brain-source.json`. Python requires NumPy and Pillow for offline processing.

```powershell
python scripts/models/z-anatomy/prepare-brain.py
node scripts/models/z-anatomy/add-brain.mjs
& $blender --background --factory-startup --disable-autoexec --python scripts/models/z-anatomy/fit-shorts.py
node scripts/models/z-anatomy/optimize.mjs
python scripts/models/z-anatomy/poster.py
node scripts/models/z-anatomy/validate.mjs
```

Run `add-brain.mjs` ONCE after a fresh nervous extraction; otherwise it would
duplicate the cortex. Re-extract nervous geometry first when rebuilding it.
Uncertain original cranial nerves/brain remain excluded. Brainstem and optic
connections are explicitly recorded schematic geometry, not measured anatomy.

All packs use the same source-derived world transform; the browser never fits
systems independently. Raw archives, Blender files and extraction buffers stay
in ignored `.qa/`, outside runtime. Only optimized packs, preview, decoder,
licenses and provenance records belong in `public/models/anatomy/`.

The base includes externally authored **Cortu Johnstone jeans shorts (CC0)**.
Download `https://files.makehumancommunity.org/asset_packs/pants01/pants01_cc0.zip`
to `.qa/z-anatomy/shorts-source/pants01_cc0.zip`. Verify its SHA-256 against
`public/models/anatomy/shorts-source.json`, then extract only
`clothes/cortu_jeans_shorts/` below the same source directory. Its MHCLO/MHMAT
headers and the official pack listing explicitly identify CC0; the OBJ retains
a generic old exporter AGPL3 header, documented in the license audit.

`fit-shorts.py` reads the real OBJ and diffuse, preserves its trouser topology,
calibrates the waist/seat/fly/hem to the two-unit body, creates standard/mobile
geometry and bakes emerald cloth colors. `optimize.mjs` merges this geometry
AFTER body simplification so its leg openings survive. The garment uses the
same base material, rotation and reveal shader, with no extra draw call/texture.
For a clothing-only rebuild, run the fitting script, then
`node scripts/models/z-anatomy/optimize.mjs .qa/z-anatomy/raw base` and `poster.py`.
Raw body buffers are never modified by fitting, so rebuilds are idempotent.
