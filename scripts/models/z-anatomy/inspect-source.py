import bpy, json, sys, pathlib
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.open_mainfile(filepath=str(pathlib.Path(args[0]).resolve()),load_ui=False,use_scripts=False)
objects=[]
for o in bpy.data.objects:
    if o.type not in ['MESH','CURVE']: continue
    pts=[o.matrix_world @ Vector(p) for p in o.bound_box]
    objects.append(dict(name=o.name,type=o.type,modifiers=[dict(name=m.name,type=m.type,enabled=m.show_viewport,levels=getattr(m,'levels',None)) for m in o.modifiers],collections=[c.name for c in o.users_collection],vertices=len(o.data.vertices) if o.type=='MESH' else 0,polygons=len(o.data.polygons) if o.type=='MESH' else 0,bounds=[[min(p[i] for p in pts) for i in range(3)],[max(p[i] for p in pts) for i in range(3)]],materials=[m.name for m in o.data.materials if m],props={k:str(o[k])[:1000] for k in o.keys()}))
result=dict(units=str(bpy.context.scene.unit_settings.system),scale=bpy.context.scene.unit_settings.scale_length,collections=[dict(name=c.name,children=[x.name for x in c.children],objects=[o.name for o in c.objects]) for c in bpy.data.collections],objects=objects,texts={t.name:t.as_string()[:2000] for t in bpy.data.texts})
pathlib.Path(args[1]).write_text(json.dumps(result,indent=2),encoding='utf8')
print('INSPECTION',len(objects),'meshes',sum(x['vertices'] for x in objects),'vertices',len(result['collections']),'collections')
