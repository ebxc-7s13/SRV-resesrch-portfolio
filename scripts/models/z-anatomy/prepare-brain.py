"""CC BY-SA 4.0 adaptation of the verified Brain for Blender CC BY-SA 3.0 source.
Only converts the original pial brain mesh for integration into the Z-Anatomy frame.
"""
import tarfile,json,pathlib,numpy as np,hashlib
raw=pathlib.Path('.qa/z-anatomy/raw');root=pathlib.Path('.qa/z-anatomy/source');inspection=json.loads(pathlib.Path('.qa/z-anatomy/inspection.json').read_text(encoding='utf8'))
objects={o['name']:o for o in inspection['objects']}
meshes=[]
with tarfile.open(root/'brainder-pial.tar.bz2') as archive:
    for member in archive.getmembers():
        if not member.name.endswith('.obj'):continue
        data=archive.extractfile(member).read().decode();verts=[];faces=[]
        for line in data.splitlines():
            if line.startswith('v '):verts.append([float(x) for x in line.split()[1:4]])
            elif line.startswith('f '):
                face=[int(x.split('/')[0])-1 for x in line.split()[1:]]
                faces.extend([[face[0],face[i],face[i+1]] for i in range(1,len(face)-1)])
        meshes.append((np.array(verts),np.array(faces)))
positions=np.concatenate([m[0] for m in meshes]);indices=np.concatenate([m[1]+sum(len(t[0]) for t in meshes[:i]) for i,m in enumerate(meshes)])
# FreeSurfer RAS millimetres -> source Z-Anatomy left/posterior/up metres.
positions*=np.array([-1,-1,1]);lo=positions.min(axis=0);hi=positions.max(axis=0)
bounds=np.array([objects['White matter of telencephalon.r']['bounds'][0],objects['White matter of telencephalon.l']['bounds'][1]])
# Uniform scale only; preserve the MRI brain's proportions and asymmetry.
scale=float(min((bounds[1]-bounds[0])/(hi-lo)))
positions=(positions-(lo+hi)/2)*scale+bounds.mean(axis=0)
transform=np.array(json.loads((raw/'extraction.json').read_text())['transform'])
positions=(np.c_[positions,np.ones(len(positions))]@transform.T)[:,:3]
positions.astype('<f4').tofile(raw/'brain-position.bin');indices.astype('<u4').tofile(raw/'brain-indices.bin')
report=dict(source='https://s3.us-east-2.amazonaws.com/brainder/software/brain4blender/smallfiles/pial_Full_obj.tar.bz2',license='CC-BY-SA-3.0',licenseEvidence='https://brainder.org/research/brain-for-blender/',author='Anderson M. Winkler',sha256=hashlib.sha256((root/'brainder-pial.tar.bz2').read_bytes()).hexdigest(),triangles=len(indices),uniformSourceScale=scale,placement='Uniform fit into the inspected Z-Anatomy intracranial envelope; then the identical shared body transform. No browser-side independent fitting.')
pathlib.Path('public/models/anatomy/brain-source.json').write_text(json.dumps(report,indent=2))
print(report)
