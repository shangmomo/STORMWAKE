#!/usr/bin/env python3
"""Bake walkable height samples ONLY from the original, *uncut* Dutch GLB.
The sampler never creates a visible deck. It records source upward faces and
rejects positions with no support; runtime movement tests against these samples.
"""
import json,sys
from pathlib import Path
import numpy as np,trimesh
root=Path(__file__).resolve().parents[2]
asset=root/'public/models/stormwake_v47/dutch_ship_medium_pbr.glb'
out=root/'src/ship/DutchHullWalkmap.js'
s=trimesh.load(asset,force='scene');g=s.geometry['dutch_ship_medium_hull'];
n=g.face_normals;area=g.area_faces;tri=g.triangles
mask=(n[:,1]>.66)&(area>.0015)
tri=tri[mask]
# The polyhaven mesh includes decorative surfaces besides actual decks; use
# only surfaces within the original normal human-deck elevation band.
tri=tri[(tri[:,:,1].mean(axis=1)>1.35)&(tri[:,:,1].mean(axis=1)<4.6)]
# Art is aligned against the vessel's waterline once (no V44 hidden scaling).
SX=SZ=1.064;SY=.75;OY=-.40;OZ=-.70
x0,z0=-2.77,-11.5;step=.19;nx=31;nz=124
lo=[-1]* (nx*nz);hi=[-1]* (nx*nz)
from collections import Counter
for face in tri:
 ax,bx,cx=face[:,0]*SX
 az,bz,cz=face[:,2]*SZ+OZ
 dx1=bx-ax;dz1=bz-az;dx2=cx-ax;dz2=cz-az
 det=dx1*dz2-dx2*dz1
 if abs(det)<1e-8:continue
 ix0=max(0,int(np.floor((min(ax,bx,cx)-x0)/step)));ix1=min(nx-1,int(np.ceil((max(ax,bx,cx)-x0)/step)))
 iz0=max(0,int(np.floor((min(az,bz,cz)-z0)/step)));iz1=min(nz-1,int(np.ceil((max(az,bz,cz)-z0)/step)))
 ya,yb,yc=face[:,1]*SY+OY
 for iz in range(iz0,iz1+1):
  z=z0+iz*step
  for ix in range(ix0,ix1+1):
   x=x0+ix*step;dx=x-ax;dz=z-az
   u=(dx*dz2-dz*dx2)/det;v=(dz*dx1-dx*dz1)/det
   if u < -1e-5 or v < -1e-5 or u+v>1.00001:continue
   y=ya+u*(yb-ya)+v*(yc-ya)
   if not .45<y<3.25:continue
   # Height is centimeters; 0 is no support, add 200 cm offset so all values >0
   encoded=int(round((y+2.0)*100));ind=iz*nx+ix
   slot=lo if y<1.30 else hi
   if encoded>slot[ind]:slot[ind]=encoded
# Also a second 1.3+ height represents the original raised forecastle/aft decks.
countlo=sum(x>0 for x in lo);counthi=sum(x>0 for x in hi)
text='''// Generated from the *uncut* user-supplied Dutch Ship Medium Blender hull.
// Do not replace these measured surfaces with procedural overlaid planks.
// 0 = no triangle support; values are 100*(metres + 2), rounded to cm.
export const DUTCH_WALKMAP=Object.freeze({
  x0:%s,z0:%s,step:%s,nx:%s,nz:%s,
  low:%s,
  high:%s
});
'''%(x0,z0,step,nx,nz,json.dumps(lo,separators=(',',':')),json.dumps(hi,separators=(',',':')))
out.write_text(text)
print('Generated original mesh walkmap',nx,nz,countlo,counthi,'surface samples; bytes',len(text))
