// CC BY-SA 4.0. Add the rig's skin influences (JOINTS_0 / WEIGHTS_0) to the
// published anatomy GLBs without changing their geometry. Run after rig.py.
// Bones are not stored in the GLBs: every layer binds at runtime to ONE shared
// skeleton built from anatomy-motion.json, so all systems move identically.
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const dir = 'public/models/anatomy', qa = '.qa/rig';
const meta = JSON.parse(fs.readFileSync(`${dir}/anatomy-meta.json`, 'utf8'));
for (const layer of ['base', 'skeleton', 'muscles', 'nervous']) for (const tier of ['', '-low']) {
  const file = `${layer}${tier}`, doc = await io.read(`${dir}/${file}.glb`);
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0], count = prim.getAttribute('POSITION').getCount();
  if (prim.getAttribute('JOINTS_0')) throw new Error(`${file}: already rigged — restore the original GLB first`);
  const joints = new Uint8Array(fs.readFileSync(`${qa}/${file}.joints.u8`)), weights = new Uint8Array(fs.readFileSync(`${qa}/${file}.weights.u8`));
  if (joints.length !== count * 4 || weights.length !== count * 4) throw new Error(`${file}: influence count mismatch`);
  const buffer = doc.getRoot().listBuffers()[0];
  prim.setAttribute('JOINTS_0', doc.createAccessor('joints').setType('VEC4').setArray(joints).setBuffer(buffer));
  prim.setAttribute('WEIGHTS_0', doc.createAccessor('weights').setType('VEC4').setArray(weights).setNormalized(true).setBuffer(buffer));
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 16, quantizeNormal: 10 }));
  doc.getRoot().setExtras({ ...doc.getRoot().getExtras(), rig: 'JOINTS_0/WEIGHTS_0 from scripts/models/z-anatomy/rig.py; bones in anatomy-motion.json' });
  await io.write(`${dir}/${file}.glb`, doc);
  const bytes = fs.statSync(`${dir}/${file}.glb`).size;
  meta.systems[layer].tiers[tier ? 'low' : 'standard'].bytes = bytes;
  console.log(file, count, 'vertices', bytes, 'bytes');
}
meta.rig = { joints: 'JOINTS_0 / WEIGHTS_0, 4 influences', skeleton: 'anatomy-motion.json', fitting: 'scripts/models/z-anatomy/rig.py' };
fs.writeFileSync(`${dir}/anatomy-meta.json`, JSON.stringify(meta, null, 2) + '\n');
