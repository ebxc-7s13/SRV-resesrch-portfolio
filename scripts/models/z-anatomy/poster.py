"""CC BY-SA 4.0. Rasterize the licensed official surface geometry."""
from pathlib import Path
import sys
import numpy as np
from PIL import Image
W,H=512,900
SCALE=375
data={'base':{'positions':np.fromfile('.qa/z-anatomy/raw/base-position.bin',dtype='<f4'),'indices':np.fromfile('.qa/z-anatomy/raw/base-indices.bin',dtype='<u4'),'colors':np.fromfile('.qa/z-anatomy/raw/base-color.bin',dtype='<f4').reshape(-1,3)}}
shorts = Path('.qa/z-anatomy/raw/shorts-position.bin')
if shorts.exists():
    base = data['base']; offset = len(base['positions'])//3
    base['positions'] = np.concatenate([base['positions'],np.fromfile(shorts,dtype='<f4')])
    base['indices'] = np.concatenate([base['indices'],np.fromfile('.qa/z-anatomy/raw/shorts-indices.bin',dtype='<u4')+offset])
    base['colors'] = np.concatenate([base['colors'],np.fromfile('.qa/z-anatomy/raw/shorts-color.bin',dtype='<f4').reshape(-1,3)])
def project(name, color):
    mesh = data[name]
    vertices = np.array(mesh['positions']).reshape(-1, 3)
    angle = float(sys.argv[2]) if len(sys.argv)>2 else 0
    radians = np.deg2rad(angle)
    vertices = vertices @ np.array([[np.cos(radians),0,-np.sin(radians)],[0,1,0],[np.sin(radians),0,np.cos(radians)]])
    indices = np.array(mesh['indices']).reshape(-1, 3)
    normals = np.zeros_like(vertices)
    face = np.cross(vertices[indices[:, 1]] - vertices[indices[:, 0]], vertices[indices[:, 2]] - vertices[indices[:, 0]])
    for corner in range(3):
        np.add.at(normals, indices[:, corner], face)
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-10)
    points = vertices.copy()
    points[:, 0] = W / 2 + vertices[:, 0] * SCALE
    points[:, 1] = H / 2 + (1 - vertices[:, 1]) * SCALE
    zbuffer = np.full((H, W), -np.inf)
    pixels = np.zeros((H, W, 4), dtype=np.uint8)
    light = np.array([-0.4, 0.65, 1.0]); light /= np.linalg.norm(light)
    for ids in indices:
        a, b, c = points[ids]
        x0, y0 = np.maximum(np.floor(np.min(points[ids, :2], axis=0)).astype(int), [0, 0])
        x1, y1 = np.minimum(np.ceil(np.max(points[ids, :2], axis=0)).astype(int), [W - 1, H - 1])
        if x1 < x0 or y1 < y0: continue
        den = (b[1]-c[1])*(a[0]-c[0]) + (c[0]-b[0])*(a[1]-c[1])
        if abs(den) < 1e-8: continue
        yy, xx = np.mgrid[y0:y1+1, x0:x1+1]
        u = ((b[1]-c[1])*(xx-c[0]) + (c[0]-b[0])*(yy-c[1])) / den
        v = ((c[1]-a[1])*(xx-c[0]) + (a[0]-c[0])*(yy-c[1])) / den
        t = 1-u-v
        zz = u*a[2]+v*b[2]+t*c[2]
        zview = zbuffer[y0:y1+1, x0:x1+1]
        mask = (u >= -1e-4) & (v >= -1e-4) & (t >= -1e-4) & (zz > zview)
        if not mask.any(): continue
        nn = u[..., None]*normals[ids[0]] + v[..., None]*normals[ids[1]] + t[..., None]*normals[ids[2]]
        nn /= np.maximum(np.linalg.norm(nn, axis=2, keepdims=True), 1e-10)
        shade = 0.32 + 0.68*np.maximum(0, nn @ light)
        rgba = np.zeros((*shade.shape, 4), dtype=np.uint8)
        cc = u[..., None]*mesh['colors'][ids[0]]+v[..., None]*mesh['colors'][ids[1]]+t[..., None]*mesh['colors'][ids[2]]
        rgba[..., :3] = np.clip(shade[..., None]*np.maximum(cc,0)**(1/2.2)*255, 0, 255)
        rgba[..., 3] = 255
        pixels[y0:y1+1, x0:x1+1][mask] = rgba[mask]
        zview[mask] = zz[mask]
    return pixels

pixels=project('base',(89,151,112))
output=Path(sys.argv[1] if len(sys.argv)>1 else 'public/models/anatomy/preview.webp')
Image.fromarray(pixels).save(output,quality=88,method=6)
print(output,output.stat().st_size)
