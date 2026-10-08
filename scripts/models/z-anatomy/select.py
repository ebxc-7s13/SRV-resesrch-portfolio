"""CC BY-SA 4.0. License-aware selection from the inspected official archive."""
import json, pathlib, sys
inspection=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf8'))
collections={c['name']:c for c in inspection['collections']}
objects={o['name']:o for o in inspection['objects']}
def descendants(name,seen=None):
    seen=set() if seen is None else seen
    if name in seen:return set()
    seen.add(name)
    c=collections[name]; result=set(c['objects'])
    for child in c['children']:result.update(descendants(child,seen))
    return result
def renderable(name):
    o=objects.get(name)
    return o and ((o['type']=='MESH' and o['polygons']>0) or o['type']=='CURVE') and o['materials'] and not name.endswith(('.j','.g','.i','.t','.s','.ol','.or'))
def pick(names):return sorted(n for n in names if renderable(n))
base=pick(n for n,o in objects.items() if any(m.startswith('Skin-') for m in o['materials']) and '9: Regions of human body' in o['collections'])
ear=descendants('Auditory ossicles')|descendants('Sense organs')
soft_nose={'Major alar cartilage.l','Major alar cartilage.r','Lateral process of nasal septal cartilage.l','Lateral process of nasal septal cartilage.r','Nasal septal cartilage'}
skeleton=pick(n for n in descendants('Skeletal system')-ear-soft_nose if any(m.startswith(('Bone','Teeth','Cartilage')) for m in objects.get(n,{}).get('materials',[])))
muscles=pick(descendants('Muscles'))
# CAHID's current official model gives no CC license: exclude the whole subtree.
cranial=descendants('Cranial nerves')
nervous=pick(n for n in ((descendants('Peripheral nervous system')-cranial)|{'White matter of spinal cord','Anterior horn of spinal cord','Posterior horn of spinal cord'}) if n in {'White matter of spinal cord','Anterior horn of spinal cord','Posterior horn of spinal cord'} or any(m.startswith('Nerve') for m in objects.get(n,{}).get('materials',[])))
eyes=pick({'Sclera.l','Sclera.r','Iris.l','Iris.r','Retina.l','Retina.r'})
base=sorted(set(base)|{'Sclera.l','Sclera.r','Iris.l','Iris.r'})
nervous=sorted(set(nervous)|set(eyes))
manifest=dict(source='https://github.com/Z-Anatomy/Models-of-human-anatomy/raw/master/Z-Anatomy.zip',sha256='e029688545627bd0214b269e1063143abb580aad72b2c2445d6d8a9a0d9da736',sourceFile='Z-Anatomy/Startup.blend',license='CC-BY-SA-4.0',credits=['BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan','Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0','Brain for Blender - Anderson M. Winkler - CC-BY-SA 3.0' ],systems=dict(base=base,skeleton=skeleton,muscles=muscles,nervous=nervous),excluded=dict(cranial=sorted(cranial-set(muscles)),cranialMuscleCrossReferencesRetained=sorted(cranial & set(muscles)),brain=sorted(descendants('Brain')),senseOrgans=sorted(descendants('Sense organs')-set(eyes)),softNose=sorted(soft_nose),auditoryOssicles=sorted(descendants('Auditory ossicles')),other='No visceral systems, kidneys, renal pelvis, ureters, inner ear, definitions, add-on scripts, helper labels or insertion markers exported.'),evidence=['https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/master/License.txt','Startup.blend: text block 1.Licence','https://github.com/Z-Anatomy/Models-of-human-anatomy/issues/7','https://api.sketchfab.com/v3/models/a9358ee7a6dd4ea18a3622114405a4c7'],limitations=['Unverified Z-Anatomy cranial nerves and brain remain excluded. The brain is adapted from the official Brain for Blender source credited by Z-Anatomy, with verified CC BY-SA 3.0 permission. Brainstem and optic nerve connections are anatomical reconstructions, not measured structures.'])
out=pathlib.Path(sys.argv[2]);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(manifest,indent=2),encoding='utf8')
print({k:len(v) for k,v in manifest['systems'].items()})
