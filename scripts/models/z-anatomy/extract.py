"""CC BY-SA 4.0. Run with official Blender --background --disable-autoexec."""
import bpy, bmesh, json, pathlib, sys, array, math
from mathutils import Vector, Matrix
args=sys.argv[sys.argv.index('--')+1:]
source,allowlist,out=map(pathlib.Path,args[:3]);out.mkdir(parents=True,exist_ok=True)
selection=json.loads(allowlist.read_text(encoding='utf8'))
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),load_ui=False,use_scripts=False)
points=[o.matrix_world @ Vector(p) for n in selection['systems']['base'] for o in [bpy.data.objects[n]] for p in o.bound_box]
lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
scale=2/(hi.z-lo.z);center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
matrix=Matrix.Scale(scale,4) @ Matrix.Rotation(-math.pi/2,4,'X') @ Matrix.Translation(-center)
report=dict(transform=[list(row) for row in matrix],sourceBounds=[list(lo),list(hi)],units='metres, Z-up; exported Y-up, anterior +Z',systems={})
for n in selection['systems']['base']:
    for mod in bpy.data.objects[n].modifiers:mod.show_viewport=False;mod.show_render=False
for o in bpy.data.objects:
    if o.type=='CURVE':o.data.resolution_u=min(o.data.resolution_u,5);o.data.bevel_resolution=min(o.data.bevel_resolution,1)
bpy.context.view_layer.update();depsgraph=bpy.context.evaluated_depsgraph_get()
if len(args)>3 and (out/'extraction.json').exists():report['systems']=json.loads((out/'extraction.json').read_text())['systems']
for system,names in selection['systems'].items():
    if len(args)>3 and system not in args[3].split(','):continue
    positions=[];indices=[];sources=[];colors=[]
    for name in names:
        obj=bpy.data.objects[name];evaluated=obj.evaluated_get(depsgraph)
        mesh=evaluated.to_mesh();mesh.calc_loop_triangles();transform=matrix @ obj.matrix_world;offset=len(positions)
        positions.extend(tuple(transform @ v.co) for v in mesh.vertices);count=0
        color=(0.006,0.018,0.012,1) if name.startswith('Iris.') else (0.006,0.008,0.005,1) if name.startswith('Retina.') else (0.5,0.56,0.47,1) if name.startswith('Sclera.') else (1,1,1,1) if system=='nervous' else (0.035,0.235,0.124,1)
        colors.extend([color]*len(mesh.vertices))
        for tri in mesh.loop_triangles:
            mat=mesh.materials[tri.material_index] if len(mesh.materials)>tri.material_index else None
            if system=='base' and mat and mat.name=='Skin-in':continue
            indices.append(tuple(offset+i for i in tri.vertices));count+=1
        sources.append(dict(name=name,triangles=count));evaluated.to_mesh_clear()
    mesh=bpy.data.meshes.new(system+'-merged');mesh.from_pydata(positions,[],indices);mesh.update()
    if system in ('base','nervous'):
        attribute=mesh.color_attributes.new(name='anatomy_color',type='FLOAT_COLOR',domain='POINT')
        attribute.data.foreach_set('color',[v for c in colors for v in c])
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=0.000008);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
    mesh.calc_loop_triangles();mesh.update()
    p=array.array('f',[x for v in mesh.vertices for x in v.co]);n=array.array('f',[x for v in mesh.vertices for x in v.normal]);i=array.array('I',[x for t in mesh.loop_triangles for x in t.vertices])
    for label,data in [('position',p),('normal',n),('indices',i)]:
        with (out/(system+'-'+label+'.bin')).open('wb') as f:data.tofile(f)
    if system in ('base','nervous'):
        data=array.array('f',[x for c in mesh.color_attributes['anatomy_color'].data for x in c.color[:3]])
        with (out/(system+'-color.bin')).open('wb') as f:data.tofile(f)
    report['systems'][system]=dict(objects=len(names),vertices=len(mesh.vertices),triangles=len(i)//3,sources=sources)
    print('EXTRACTED',system,len(mesh.vertices),len(i)//3,flush=True);bpy.data.meshes.remove(mesh)
(out/'extraction.json').write_text(json.dumps(report,indent=2),encoding='utf8')
