# Z-Anatomy asset audit - 2026-10-07

The complete official [Z-Anatomy.zip](https://github.com/Z-Anatomy/Models-of-human-anatomy/raw/master/Z-Anatomy.zip) was downloaded first: 86,734,957 bytes, SHA-256 `e029688545627bd0214b269e1063143abb580aad72b2c2445d6d8a9a0d9da736`, ZIP CRC verification passed. Its `Z-Anatomy/Startup.blend` (306,838,281 bytes) is the source for the body, bones, muscles, spinal/peripheral nerves and eyes. Embedded scripts were disabled when opening it.

[Z-Anatomy License.txt](https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/master/License.txt) grants CC BY-SA 4.0 and requires Z-Anatomy and BodyParts3D credit. The embedded `1.Licence` confirms the historical BodyParts3D CC BY-SA 2.1 Japan credit. These exact credits remain; later BodyParts3D relicensing is not used to relax this derivative's conditions.

| Export | Exact inspected selection | License |
| --- | --- | --- |
| Base | 242 body-region surface meshes with Skin materials, plus bilateral sclera and iris | Z-Anatomy/BodyParts3D; derivative CC BY-SA 4.0 |
| Skeleton | 308 bone, tooth and axial cartilage meshes; soft nasal cartilage, auditory ossicles and sense organs excluded | Z-Anatomy/BodyParts3D; derivative CC BY-SA 4.0 |
| Muscles | 509 meshes in the actual Muscles collection, including tendons; fascia/bursae/helpers excluded | Z-Anatomy/BodyParts3D; derivative CC BY-SA 4.0 |
| Nervous | 202 actual nerve/spinal structures identified by Nerve materials and the spinal cord allowlist, plus 6 source eye structures | Z-Anatomy/BodyParts3D; derivative CC BY-SA 4.0 |
| Brain within nervous pack | Official MRI-derived left/right pial meshes from Brain for Blender, credited upstream by Z-Anatomy | Anderson M. Winkler; CC BY-SA 3.0, adapted under CC BY-SA 4.0 |
| Brainstem/optic connections | New schematic anatomical geometry positioned from inspected source landmarks, explicitly requested as reconstruction fallback | New work; CC BY-SA 4.0 |
| Shorts within base pack | Cortu Johnstone `jean_shorts.obj` plus baked colors from `jean_shorts_diff.png`, official MakeHuman pants01 CC0 pack | CC0 1.0; incorporated into the CC BY-SA 4.0 body derivative |

The source hierarchy contains cross-references: nerve collections contain the muscles they innervate. Those muscles must not be exported as nerve geometry. The exact allowlists and exclusions are in `public/models/anatomy/source-selection.json`.

Excluded: all kidneys/viscera (Cowley CC BY-NC 4.0), inner ear (Dundee CC BY-NC-SA 4.0), auditory ossicles conservatively, and all uncertain Z-Anatomy cranial nerve/brain meshes. [Upstream issue 7](https://github.com/Z-Anatomy/Models-of-human-anatomy/issues/7) questions the brain provenance. Although upstream lists CAHID cranial nerves as CC BY 4.0, the [creator API](https://api.sketchfab.com/v3/models/a9358ee7a6dd4ea18a3622114405a4c7) returns an empty license and isDownloadable false. No license is invented for those assets.

To satisfy the later request for brain anatomy, the cortex is taken directly from the [official Brain for Blender pial download](https://s3.us-east-2.amazonaws.com/brainder/software/brain4blender/smallfiles/pial_Full_obj.tar.bz2), whose author's [license page](https://brainder.org/research/brain-for-blender/) explicitly grants CC BY-SA 3.0. Archive SHA-256 `b405015b9039bc0b0effb8947423b6c4ea9513406459fefd85e8f8b7c330ada2`. This is the actual upstream brain dataset credited by Z-Anatomy, not a substitute human model. The existing Z-Anatomy white-matter comparison did not conclusively establish provenance, so those meshes remain excluded. The original licensed pial mesh uses a uniform fit into the inspected intracranial envelope, followed by the same body transform. Brain metadata and reconstruction coordinates are distributed beside the GLBs.

The nerve and muscle subsets are anatomically recognizable illustrations. Unverified cranial branches remain absent; reconstructed connections are not measured anatomy. No claim of a complete diagnostic atlas is made. GLBs, poster and model-processing scripts are distributed under CC BY-SA 4.0, with source, changes and attribution links. Raw ZIP/Blender/brain archives, medical definitions and source add-on scripts are never browser assets.


## Clothing source added for modest coverage

Cortu Johnstone jeans shorts come from the [official MakeHuman pants01 CC0 pack](https://static.makehumancommunity.org/assets/assetpacks/pants01.html). The downloaded archive passed ZIP CRC checks; SHA-256 `e4e0ec60db34f279be291a83cfd7b342a7c5cf09bb7676682a5f39f4f6ac4ad9`. Only `clothes/cortu_jeans_shorts/` was extracted for processing. The author-authored MHCLO and MHMAT both explicitly state `Cortu Johnstone - CC0`, matching the official pack listing. The OBJ contains an old generic MakeClothes `Unknown`/AGPL3 exporter header; the explicit author release identifies the clothing itself as CC0. This discrepancy is preserved in the provenance rather than silently discarded.

The real OBJ topology and diffuse are adapted; the normal map and original texture are not browser downloads. Fitting preserves two trouser leg openings, adds bounded fabric thickness/rims, adjusts waist/fly/seat clearance, and bakes muted emerald vertex colors. Clothes are merged into the existing base, use its existing reveal shader and remain aligned to every internal system. Body source geometry, skeleton/muscle/nerve packs and camera implementation are unchanged. Clothing credit and exact file hashes are in `public/models/anatomy/shorts-source.json` and the existing anatomical attribution.
