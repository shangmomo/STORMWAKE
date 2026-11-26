"""CPU orthographic geometry preview; not an in-game/WebGPU screenshot."""
from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from build_land_motion_v36 import GLB
R=Path(__file__).resolve().parents[1]
g=GLB(R/'public/models/land/crab.glb');J=g.j
palette=[np.array(m['pbrMetallicRoughness']['baseColorFactor'][:3],dtype=float) for m in J['materials']]
W,H=1440,650
im=Image.new('RGB',(W,H),(17,24,30));draw=ImageDraw.Draw(im)
for panel,(yaw,elev,label) in enumerate(((45,30,'THREE-QUARTER'),(-70,75,'TOP VIEW'))):
    yaw,elev=math.radians(yaw),math.radians(elev)
    forward=np.array([math.sin(yaw)*math.cos(elev),math.sin(elev),math.cos(yaw)*math.cos(elev)])
    right=np.array([math.cos(yaw),0,-math.sin(yaw)])
    up=np.cross(forward,right)
    tris=[]
    for mat,p in enumerate(J['meshes'][0]['primitives']):
        vertices=np.asarray(g.array(p['attributes']['POSITION']),dtype=float)
        indices=np.asarray(g.array(p['indices']),dtype=int).flatten().reshape(-1,3)
        vertices=vertices-np.array([0,.4,0])
        px=vertices@right*253+W*(panel+.5)/2
        py=H*.51-vertices@up*253
        depth=vertices@forward
        for face in indices:
            if max(px[face])-min(px[face])<.4 and max(py[face])-min(py[face])<.4:continue
            points=[(int(px[k]),int(py[k])) for k in face]
            a,b,c=vertices[face]
            n=np.cross(b-a,c-a); norm=np.linalg.norm(n)
            if norm<1e-10:continue
            n/=norm
            lighting=.35+.60*abs(np.dot(n,np.array([-.2,.72,.65])))
            rgb=tuple(int(min(255,max(0, (min(1,v*lighting)**.65)*240))) for v in palette[mat])
            tris.append((float(depth[face].mean()),points,rgb))
    for _,pts,color in sorted(tris,key=lambda x:x[0]):draw.polygon(pts,fill=color)
    x=W*(panel+.5)//2
    draw.text((int(x)-70,30),label,fill=(224,233,244))
    draw.text((int(x)-137,H-38),'34 bones / 6 original clips / 6 surfaces',fill=(143,171,193))
draw.line((W//2,30,W//2,H-35),fill=(50,62,75),width=2)
out=R/'docs/V36_crab_mesh_review.png';im.save(out);print(out,im.size)
