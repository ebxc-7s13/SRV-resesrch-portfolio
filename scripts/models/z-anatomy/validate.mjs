import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { Matrix4, Vector3 } from 'three';
await MeshoptDecoder.ready;
const directory='public/models/anatomy';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const meta=JSON.parse(fs.readFileSync(`${directory}/anatomy-meta.json`));
const selection=JSON.parse(fs.readFileSync(`${directory}/source-selection.json`));
const report={checks:[],bounds:{},assetBytes:0};
for (const [system,info] of Object.entries(meta.systems)) {
  for (const [tier,stats] of Object.entries(info.tiers)) {
    const file=`${directory}/${stats.file}`,doc=await io.read(file);
    assert.equal(doc.getRoot().listMeshes().length,1);
    assert.equal(doc.getRoot().listMeshes()[0].listPrimitives().length,1);
    assert.equal(fs.statSync(file).size,stats.bytes);
    assert.ok(doc.getRoot().listExtensionsRequired().some(ext=>ext.extensionName==='EXT_meshopt_compression'));
    const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
    for(const node of doc.getRoot().listNodes()) {
      if(!node.getMesh())continue;
      const matrix=new Matrix4().fromArray(node.getWorldMatrix());
      for(const prim of node.getMesh().listPrimitives()) {
        const positions=prim.getAttribute('POSITION'),point=new Vector3(),value=[];
        for(let i=0;i<positions.getCount();i++) {
          positions.getElement(i,value);point.fromArray(value).applyMatrix4(matrix);
          point.toArray().forEach((x,axis)=>{assert.ok(Number.isFinite(x));bounds.min[axis]=Math.min(bounds.min[axis],x);bounds.max[axis]=Math.max(bounds.max[axis],x);});
        }
      }
    }
    // All source systems remain inside the SAME normalized two-unit body volume.
    assert.ok(bounds.min[1]>-.04 && bounds.max[1]<2.04,`${system} vertical alignment`);
    assert.ok(bounds.min[0]>-.65 && bounds.max[0]<.65,`${system} lateral alignment`);
    report.bounds[`${system}-${tier}`]=bounds;report.assetBytes+=stats.bytes;
  }
  assert.equal(info.sourceObjects,selection.systems[system].length);
}
for(const excluded of [...selection.excluded.cranial,...selection.excluded.brain,...selection.excluded.senseOrgans,...selection.excluded.auditoryOssicles]) {
  assert.ok(!Object.values(selection.systems).some(names=>names.includes(excluded)),`Excluded object: ${excluded}`);
}
for (const name of selection.excluded.softNose) assert.ok(!selection.systems.skeleton.includes(name),`Soft nasal cartilage excluded: ${name}`);
for (const name of ['Sclera.l','Sclera.r','Retina.l','Retina.r']) assert.ok(selection.systems.nervous.includes(name),`Anatomical eyes included: ${name}`);
assert.equal(JSON.parse(fs.readFileSync(`${directory}/brain-source.json`)).license,'CC-BY-SA-3.0');
assert.ok(meta.systems.base.tiers.standard.bytes<250000);
assert.ok(meta.systems.base.tiers.low.bytes<120000);
assert.ok(!fs.readdirSync(directory).some(file=>/\.(zip|blend|fbx)$/i.test(file)));
report.checks=['8 GLBs decoded successfully','one mesh/primitive per pack','required Meshopt compression','finite coordinates inside shared body volume','source object counts match audit','uncertain/noncommercial subtrees excluded','base payload budgets met','no raw archive/source file in runtime'];
fs.mkdirSync('.qa/z-anatomy',{recursive:true});fs.writeFileSync('.qa/z-anatomy/asset-validation.json',JSON.stringify(report,null,2));
console.log(report);
