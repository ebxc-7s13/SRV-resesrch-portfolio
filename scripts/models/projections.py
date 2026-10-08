"""Orthographic source vertex projections for orientation review, never a substitute mesh."""
import numpy as np
from PIL import Image, ImageDraw
for name in ['mmsa', 'microscope']:
    p = np.fromfile(f'.qa/models/{name}-points.bin', dtype=np.float32).reshape(-1, 3)
    image = Image.new('RGB', (1500, 580), '#edf0ed')
    draw = ImageDraw.Draw(image)
    for j, (a,b,title) in enumerate([(0,1,'X / Y'),(0,2,'X / Z'),(1,2,'Y / Z')]):
        q = p[:,[a,b]]; lo=q.min(0); hi=q.max(0); q=(q-(hi+lo)/2)*430/max(hi-lo)
        q[:,0]+=250+j*500;q[:,1]=280-q[:,1]
        for x,y in q.astype(int): draw.point((int(x),int(y)),fill='#324b52')
        draw.text((j*500+24,30), name+' SOURCE  '+title,fill='#182f36')
    image.save(f'.qa/models/{name}-projections.png')
