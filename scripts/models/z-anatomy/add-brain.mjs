// CC BY-SA 4.0. Combine the verified MRI cortex and anatomical reconstructions.
import fs from 'node:fs';
import { BufferGeometry, BufferAttribute, CatmullRomCurve3, TubeGeometry, Vector3 } from 'three';
const raw='.qa/z-anatomy/raw';
function read(name,Type){const b=fs.readFileSync(`${raw}/${name}.bin`);return new Type(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
const positions=[read('nervous-position',Float32Array),read('brain-position',Float32Array)];
const indices=[read('nervous-indices',Uint32Array),read('brain-indices',Uint32Array)];
const colors=[read('nervous-color',Float32Array),new Float32Array(positions[1].length).fill(1)];
const reconstruction=[];
function tube(name,points,radius,radii) {
 const path=new CatmullRomCurve3(points.map(p=>new Vector3(...p)));
 const geometry=new TubeGeometry(path,24,radius,16,false);
 if(radii) for(let ring=0;ring<=24;ring++) {
  const t=ring/24,center=path.getPointAt(t),index=t*(radii.length-1),left=Math.min(Math.floor(index),radii.length-2);
  const localRadius=radii[left]+(radii[left+1]-radii[left])*(index-left);
  for(let side=0;side<=16;side++) {
   const i=ring*17+side,point=new Vector3().fromBufferAttribute(geometry.attributes.position,i);
   point.sub(center).multiplyScalar(localRadius/radius).add(center);geometry.attributes.position.setXYZ(i,point.x,point.y,point.z);
  }
 }
 positions.push(geometry.attributes.position.array);indices.push(geometry.index.array);
 colors.push(new Float32Array(geometry.attributes.position.array.length).fill(1));
 reconstruction.push({name,points,radius,radii,provenance:'New schematic anatomical reconstruction requested by the user; not source/MRI geometry'});
}
// Brainstem joins the intracranial envelope to the source spinal cord.
tube('brainstem',[[0,1.878,-.011],[0,1.855,-.008],[0,1.825,-.024],[0,1.800,-.024]],.011,[.006,.011,.006,.0035]);
// Optic nerves pass posteriorly from the eyeballs to the optic chiasm.
for(const side of [-1,1])tube(side<0?'right optic nerve':'left optic nerve',[[side*.036,1.862,.065],[side*.025,1.877,.047],[side*.009,1.884,.028],[0,1.886,.020],[side*.012,1.894,-.007]],.0022);
const total=positions.reduce((s,p)=>s+p.length,0),p=new Float32Array(total);let offset=0,indexOffset=0;
const ind=new Uint32Array(indices.reduce((s,a)=>s+a.length,0));
positions.forEach((a,k)=>{p.set(a,offset);indices[k].forEach((n,j)=>ind[indexOffset+j]=n+offset/3);indexOffset+=indices[k].length;offset+=a.length;});
const color=new Float32Array(total);offset=0;colors.forEach(a=>{color.set(a,offset);offset+=a.length;});
fs.writeFileSync(`${raw}/nervous-color.bin`,Buffer.from(color.buffer));
const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(p,3)).setIndex(new BufferAttribute(ind,1));geometry.computeVertexNormals();
fs.writeFileSync(`${raw}/nervous-position.bin`,Buffer.from(p.buffer));fs.writeFileSync(`${raw}/nervous-normal.bin`,Buffer.from(geometry.attributes.normal.array.buffer));fs.writeFileSync(`${raw}/nervous-indices.bin`,Buffer.from(ind.buffer));
const report=JSON.parse(fs.readFileSync(`${raw}/extraction.json`));report.systems.nervous.vertices=p.length/3;report.systems.nervous.triangles=ind.length/3;report.systems.nervous.additionalSources={brain:JSON.parse(fs.readFileSync('public/models/anatomy/brain-source.json')),reconstruction};fs.writeFileSync(`${raw}/extraction.json`,JSON.stringify(report,null,2));
fs.writeFileSync('public/models/anatomy/reconstructions.json',JSON.stringify(reconstruction,null,2));
console.log('Nervous pack with aligned cortex/eyes:',p.length/3,'vertices',ind.length/3,'triangles');
