# Z-Anatomy homepage anatomy

**BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan**

**Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0**

**Jeans shorts - Cortu Johnstone - CC0 1.0**. Real clothing geometry and diffuse
from the [official MakeHuman pants01 CC0 pack](https://static.makehumancommunity.org/assets/assetpacks/pants01.html).
Subdivided, fitted to this body's waist/seat/thighs, given fabric thickness and
emerald vertex colors, and consolidated into the base GLB. Exact source archive,
hashes and license evidence are in [shorts provenance](./shorts-source.json).

**Brain for Blender - Anderson M. Winkler - CC BY-SA 3.0** ([original license](https://brainder.org/research/brain-for-blender/), [MRI-derived pial source](https://s3.us-east-2.amazonaws.com/brainder/software/brain4blender/smallfiles/pial_Full_obj.tar.bz2)). The brain is uniformly fitted into the Z-Anatomy cranial envelope and adapted under CC BY-SA 4.0.

Z-Anatomy contributors: Kousaku Okubo (original BodyParts3D), Gauthier Kervyn (design, 3D and anatomy), Marcin Zieliński and the contributors listed in the [official license](https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/License.txt).

These derived GLBs and the anatomical preview are shared under [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/). Preserve these credits, identify further changes and share adapted assets under that license.

Source: [official Z-Anatomy repository](https://github.com/Z-Anatomy/Models-of-human-anatomy), [complete original archive](https://github.com/Z-Anatomy/Models-of-human-anatomy/raw/master/Z-Anatomy.zip), `Z-Anatomy/Startup.blend`. Archive SHA-256: `e029688545627bd0214b269e1063143abb580aad72b2c2445d6d8a9a0d9da736`.

Changes: selected licensed body-region surfaces, bones/teeth/cartilage, muscles/tendons and spinal/peripheral nerves; removed helpers and duplicate vertices; removed surface thickness/internal faces; bounded curve tessellation; applied one common Y-up transform; consolidated one mesh per system; simplified standard/lightweight tiers; quantized and compressed using Meshopt. The preview is a rendering of the same licensed body surface. No unrelated human model is used. The schematic reconstructions are identified separately below.

The nervous layer shows the brain, eyes, spinal cord and peripheral/autonomic network. See [brain provenance](./brain-source.json) and [reconstructed connections](./reconstructions.json). Unverified Z-Anatomy brain and cranial nerve meshes are excluded. The cortex comes directly from the verified Brain for Blender upstream above; brainstem/optic connections are new schematic reconstructions. Source eyes are included. Inner ear, auditory ossicles, all kidneys and other visceral systems are excluded. No noncommercial or unverified third-party assets are shipped. See [exact source selection](./source-selection.json) and [output metadata](./anatomy-meta.json).

Reproduction scripts: `scripts/models/z-anatomy/select.py`, `extract.py`, `prepare-brain.py`, `add-brain.mjs`, `fit-shorts.py`, `optimize.mjs`, `poster.py` in the website source repository (CC BY-SA 4.0). Download the complete official archive; inspect with Blender with auto-execution disabled; generate the selection, extract to an offline directory, fit the CC0 shorts, optimize, then render the preview. The source archives and raw Blender file are deliberately not runtime downloads.

This illustration is not a complete anatomy atlas and makes no diagnostic claim.
