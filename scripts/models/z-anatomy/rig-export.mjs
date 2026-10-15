// CC BY-SA 4.0. Dump the published anatomy GLBs' model-space vertices for rigging.
// Output (git-ignored): .qa/rig/<file>.pos.f32 (xyz float32) and .idx.u32.
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const dir = process.argv[2] ?? 'public/models/anatomy', out = process.argv[3] ?? '.qa/rig';
fs.mkdirSync(out, { recursive: true });
const summary = {};
for (const layer of ['base', 'skeleton', 'muscles', 'nervous']) for (const tier of ['', '-low']) {
  const file = `${layer}${tier}`, doc = await io.read(`${dir}/${file}.glb`);
  const nodes = doc.getRoot().listNodes().filter(n => n.getMesh());
  if (nodes.length !== 1) throw new Error(`${file}: expected one mesh node`);
  const node = nodes[0], m = node.getWorldMatrix(), prims = node.getMesh().listPrimitives();
  if (prims.length !== 1) throw new Error(`${file}: expected one primitive`);
  const pos = prims[0].getAttribute('POSITION'), n = pos.getCount(), world = new Float32Array(n * 3), v = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    pos.getElement(i, v);
    world[i * 3] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
    world[i * 3 + 1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
    world[i * 3 + 2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
  }
  fs.writeFileSync(`${out}/${file}.pos.f32`, Buffer.from(world.buffer));
  fs.writeFileSync(`${out}/${file}.idx.u32`, Buffer.from(new Uint32Array(prims[0].getIndices().getArray()).buffer));
  summary[file] = { vertices: n, attributes: prims[0].listSemantics(), matrix: Array.from(m) };
}
fs.writeFileSync(`${out}/export.json`, JSON.stringify(summary, null, 1));
console.log(Object.fromEntries(Object.entries(summary).map(([k, s]) => [k, [s.vertices, s.attributes.join('/')]])));
