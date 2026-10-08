"""Fit the externally authored CC0 Cortu shorts to the audited body, offline.

Run with Blender --background --factory-startup --disable-autoexec. No source
scripts or MakeHuman plugins are executed. Body/system coordinates are unchanged.
"""
import bpy, bmesh, array, json, pathlib, math, hashlib

ROOT = pathlib.Path('.qa/z-anatomy')
SOURCE = ROOT / 'shorts-source/clothes/cortu_jeans_shorts'
RAW = ROOT / 'raw'
def read(name, kind, code):
    data = array.array(code)
    with (RAW / f'{name}-{kind}.bin').open('rb') as stream: data.frombytes(stream.read())
    return data

positions = read('base', 'position', 'f')
body_height = max(positions[1::3])-min(positions[1::3])
assert abs(body_height-2)<.001, 'Recalibrate garment landmarks if the body transform changes'

# Preserve the real OBJ's topology and UVs, including its two open trouser legs.
verts, uvs, polygons, face_uvs = [], [], [], []
for line in (SOURCE / 'jean_shorts.obj').read_text().splitlines():
    parts = line.split()
    if not parts: continue
    if parts[0] == 'v': verts.append(tuple(map(float, parts[1:4])))
    elif parts[0] == 'vt': uvs.append(tuple(map(float, parts[1:3])))
    elif parts[0] == 'f':
        polygons.append([int(p.split('/')[0])-1 for p in parts[1:]])
        face_uvs.append([int(p.split('/')[1])-1 for p in parts[1:]])

image = bpy.data.images.load(str((SOURCE / 'jean_shorts_diff.png').resolve()), check_existing=True)
pixels = array.array('f', [0]) * (image.size[0]*image.size[1]*4)
image.pixels.foreach_get(pixels)
reports = {}
for low, subdivisions in [(False, 2), (True, 1)]:
    mesh = bpy.data.meshes.new('CC0-Cortu-shorts')
    mesh.from_pydata(verts, [], polygons); mesh.update()
    uv_layer = mesh.uv_layers.new(name='source-UV')
    for poly, uv_ids in zip(mesh.polygons, face_uvs):
        for loop, uv_id in zip(poly.loop_indices, uv_ids): uv_layer.data[loop].uv = uvs[uv_id]
    obj = bpy.data.objects.new('fitted-shorts', mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj; obj.select_set(True)
    modifier = obj.modifiers.new('Source garment subdivision', 'SUBSURF')
    modifier.levels = subdivisions; modifier.subdivision_type = 'CATMULL_CLARK'
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    mesh = obj.data
    for vertex in mesh.vertices:
        x, sy, z = vertex.co
        y = .99 + .17*sy
        # Smooth garment morph: preserve the authored panel topology instead of
        # projecting separate vertices across the two disconnected thighs.
        vertex.co.x = x*(.124 + .008*max(0,min(1,(sy+.1)/.7)))
        leg = max(0, min(1, (-sy-.25)/.55))
        z_center = .37 + .08*leg
        vertex.co.z = (z-z_center)*.155-.012
        vertex.co.y = y
        # Seat clearance and modest fabric volume across the front fly.
        if z < z_center:
            seat = max(0, 1-abs(y-1.01)/.17)
            vertex.co.z -= .026*seat
        if z > z_center:
            fly = max(0, 1-abs(x)/.9)*max(0, 1-abs(y-.945)/.17)
            vertex.co.z += .075*fly
        if z > .25 and y < 1.09:
            central = max(0, 1-(abs(x)/.75)**2)
            vertex.co.z += max(0,.157-vertex.co.z)*central
        if vertex.co.z < -.18:
            vertex.co.z = -.18 + (vertex.co.z+.18)*.32
    mesh.update()
    # Small actual fabric thickness, with closed waistband and hem edge rims.
    modifier = obj.modifiers.new('Fabric thickness and edge hems', 'SOLIDIFY')
    modifier.thickness = .003; modifier.offset = 0; modifier.use_rim = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier = obj.modifiers.new('Bounded garment complexity', 'DECIMATE')
    modifier.ratio = .5 if not low else .65
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    mesh = obj.data
    bm = bmesh.new(); bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(mesh); bm.free()
    mesh.calc_loop_triangles(); mesh.update()
    # Bake the source denim's folds/seams into vertex colors. No texture request
    # or extra material/draw call is introduced in the homepage renderer.
    colors = [[0., 0., 0.] for _ in mesh.vertices]; counts = [0]*len(colors)
    uv_layer = mesh.uv_layers.active
    for loop in mesh.loops:
        u, v = uv_layer.data[loop.index].uv
        px = max(0,min(image.size[0]-1,round(u*(image.size[0]-1))))
        py = max(0,min(image.size[1]-1,round(v*(image.size[1]-1))))
        at = (py*image.size[0]+px)*4
        luminance = .2126*pixels[at]+.7152*pixels[at+1]+.0722*pixels[at+2]
        # Source diffuse includes stitched panels; retain its value variation.
        shade = .45 + math.sqrt(max(0,luminance))*2.4
        for axis, channel in enumerate((.052,.082,.066)): colors[loop.vertex_index][axis] += channel*shade
        counts[loop.vertex_index] += 1
    for i in range(len(colors)):
        colors[i] = [v/max(1,counts[i]) for v in colors[i]]
    prefix = 'shorts-low' if low else 'shorts'
    buffers = {
        'position':array.array('f',[c for v in mesh.vertices for c in v.co]),
        'normal':array.array('f',[c for v in mesh.vertices for c in v.normal]),
        'indices':array.array('I',[i for t in mesh.loop_triangles for i in t.vertices]),
        'color':array.array('f',[c for row in colors for c in row]),
    }
    for kind, data in buffers.items():
        with (RAW / f'{prefix}-{kind}.bin').open('wb') as stream: data.tofile(stream)
    reports[prefix] = dict(vertices=len(mesh.vertices), triangles=len(mesh.loop_triangles),
        bounds=[[min(v.co[i] for v in mesh.vertices) for i in range(3)], [max(v.co[i] for v in mesh.vertices) for i in range(3)]])
    bpy.data.objects.remove(obj, do_unlink=True)

provenance = dict(
    asset='jean_shorts.obj', author='Cortu Johnstone', license='CC0-1.0',
    licenseEvidence='Author-authored MHCLO and MHMAT headers: Cortu Johnstone - CC0; official CC0 pack listing',
    licenseNote='OBJ carries an old generic MakeClothes AGPL3 exporter header; the explicit author release and official pack identify the clothing asset as CC0.',
    page='https://static.makehumancommunity.org/assets/assetpacks/pants01.html',
    archive='https://files.makehumancommunity.org/asset_packs/pants01/pants01_cc0.zip',
    archiveSHA256=hashlib.sha256((ROOT/'shorts-source/pants01_cc0.zip').read_bytes()).hexdigest(),
    objectSHA256=hashlib.sha256((SOURCE/'jean_shorts.obj').read_bytes()).hexdigest(),
    sourceFiles={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in SOURCE.iterdir() if p.is_file()},
    fittingLandmarks=dict(bodyHeight=2, waistbandY=1.18, lowerHemY=.812, hipHalfWidth=.233, frontFlyZ=.157, seatZ=-.20),
    modifications='Subdivided real source topology; calibrated to the shared two-unit body hip/thigh landmarks; retained crotch bridge with front fly clearance and seat shaping; fabric thickness/hem rims; source diffuse baked into emerald vertex colors; merged only into base layer.',
    tiers=reports)
pathlib.Path('public/models/anatomy/shorts-source.json').write_text(json.dumps(provenance,indent=2)+'\n')
print(json.dumps(reports, indent=2))
