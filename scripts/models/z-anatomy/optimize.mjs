// CC BY-SA 4.0. Web conversion of the audited official selection.
import fs from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const input=process.argv[2]??'.qa/z-anatomy/raw',output='public/models/anatomy';
const selection=JSON.parse(fs.readFileSync(`${output}/source-selection.json`));
const extraction=JSON.parse(fs.readFileSync(`${input}/extraction.json`));
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const selectedSystems=process.argv[3]?.split(',')??Object.keys(selection.systems);
const metadata=process.argv[3]?JSON.parse(fs.readFileSync(`${output}/anatomy-meta.json`)):{source:selection.source,sha256:selection.sha256,license:selection.license,credits:selection.credits,limitations:selection.limitations,transform:extraction.transform,systems:{}};
function buffer(name,kind,Type){const b=fs.readFileSync(`${input}/${name}-${kind}.bin`);return new Type(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
for (const name of Object.keys(selection.systems)) {
  if(!selectedSystems.includes(name))continue;
  metadata.systems[name]={sourceObjects:extraction.systems[name].objects,sourceTriangles:extraction.systems[name].triangles,tiers:{}};
  for (const low of [false,true]) {
    const doc=new Document(),buf=doc.createBuffer();
    const pos=doc.createAccessor('positions').setType('VEC3').setArray(buffer(name,'position',Float32Array)).setBuffer(buf);
    const nor=doc.createAccessor('normals').setType('VEC3').setArray(buffer(name,'normal',Float32Array)).setBuffer(buf);
    const ind=doc.createAccessor('indices').setType('SCALAR').setArray(buffer(name,'indices',Uint32Array)).setBuffer(buf);
    const mat=doc.createMaterial(name).setBaseColorFactor([.25,.55,.36,1]).setRoughnessFactor(.65);
    const prim=doc.createPrimitive().setAttribute('POSITION',pos).setAttribute('NORMAL',nor).setIndices(ind).setMaterial(mat);
    if(fs.existsSync(`${input}/${name}-color.bin`))prim.setAttribute('COLOR_0',doc.createAccessor('anatomical colors').setType('VEC3').setArray(buffer(name,'color',Float32Array)).setBuffer(buf));
    doc.createScene('Z-Anatomy aligned systems').addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
    doc.getRoot().getAsset().copyright=selection.credits.join('; ')+'; derivative CC BY-SA 4.0';
    doc.getRoot().setExtras({source:selection.source,sourceArchiveSHA256:selection.sha256,license:'https://creativecommons.org/licenses/by-sa/4.0/',modifications:'Licensed selection; common Y-up transform; consolidated geometry; simplification; Meshopt compression',limitations:selection.limitations});
    await doc.transform(dedup(),weld());
    const target={base:low?18000:42000,skeleton:low?60000:145000,muscles:low?75000:180000,nervous:low?85000:180000}[name];
    await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio:Math.min(1,target/(ind.getCount()/3)),error:low?.008:.002,lockBorder:name==='base'}));
    if(name==='base') {
      // Attach the real fitted garment AFTER simplifying the body. This keeps
      // its waistband/leg openings intact and preserves the body's LOD budget.
      const shorts=low?'shorts-low':'shorts',offset=prim.getAttribute('POSITION').getCount();
      for(const [semantic,kind] of [['POSITION','position'],['NORMAL','normal'],['COLOR_0','color']]) {
        const accessor=prim.getAttribute(semantic),body=accessor.getArray(),cloth=buffer(shorts,kind,Float32Array);
        const merged=new Float32Array(body.length+cloth.length);merged.set(body);merged.set(cloth,body.length);accessor.setArray(merged);
      }
      const body=prim.getIndices().getArray(),cloth=buffer(shorts,'indices',Uint32Array),merged=new Uint32Array(body.length+cloth.length);
      merged.set(body);merged.set(cloth.map(i=>i+offset),body.length);prim.getIndices().setArray(merged);
      const source=JSON.parse(fs.readFileSync(`${output}/shorts-source.json`));
      doc.getRoot().setExtras({...doc.getRoot().getExtras(),clothing:source});
      doc.getRoot().getAsset().copyright+='; shorts: Cortu Johnstone, CC0 1.0';
      metadata.systems.base.clothing='shorts-source.json';
    }
    await doc.transform(weld(),prune(),meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:10}));
    const file=`${name}${low?'-low':''}.glb`;await io.write(`${output}/${file}`,doc);
    const decoded=await io.read(`${output}/${file}`),primitives=decoded.getRoot().listMeshes().flatMap(m=>m.listPrimitives());
    const stats={file,bytes:fs.statSync(`${output}/${file}`).size,drawCalls:primitives.length,triangles:primitives.reduce((s,p)=>s+p.getIndices().getCount()/3,0),vertices:primitives.reduce((s,p)=>s+p.getAttribute('POSITION').getCount(),0),decodedGeometryBytes:primitives.reduce((s,p)=>s+p.getIndices().getArray().byteLength+p.listSemantics().reduce((n,semantic)=>n+p.getAttribute(semantic).getArray().byteLength,0),0)};
    metadata.systems[name].tiers[low?'low':'standard']=stats;console.log(name,low?'low':'standard',stats);
  }
}
fs.writeFileSync(`${output}/anatomy-meta.json`,JSON.stringify(metadata,null,2)+'\n');
