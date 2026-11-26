#!/usr/bin/env python3
"""Build conservative lateral walking boundaries from the real Dutch hull vertices."""
import argparse,json,sys,zipfile,numpy as np
from pathlib import Path
from import_uploaded_assets import Blend
p=argparse.ArgumentParser();p.add_argument('--blendzip',required=True);p.add_argument('--out',required=True);a=p.parse_args()
with zipfile.ZipFile(a.blendzip) as z:
 B=Blend(z.read(next(n for n in z.namelist() if n.endswith('.blend'))))
 name,verts,_,_,_=next(B.meshes())
 v=verts['xyz']; x=v[:,0]*1.064;h=v[:,2]*.75-1.20; longitudinal=-v[:,1]*1.064-.70
 # deck edge: hull/rail within a band near the actual walkable deck, not
 # mast/spars (rigging is a separate mesh). Exclude interior deck furniture.
 samples=[]
 for z0 in np.arange(-11.5,12.001,.5):
  sel=(abs(longitudinal-z0)<.48)&(h>-.12)&(h<1.85)
  vals=np.abs(x[sel]);vals=vals[vals>.6]
  if len(vals)>3:
   hw=float(np.quantile(vals,.93));samples.append([round(float(z0),3),round(hw,3)])
  else:samples.append([round(float(z0),3),None])
 valid=np.array([(z,w) for z,w in samples if w is not None]);
 for s in samples:
  if s[1] is None:s[1]=round(float(np.interp(s[0],valid[:,0],valid[:,1])),3)
 # Make walkable half-width conservative and clamp to between 0.85..2.35m,
 # leaving >=0.25m rail separation (the player adds its own capsule radius).
 for s in samples:s[1]=round(float(np.clip(s[1]-.12,.85,2.35)),3)
 js='''// Generated from the supplied CC0 Dutch Ship Medium Blender hull.\n// Do not use meshes as CPU colliders directly; deterministic lateral profile.\nexport const ART_HULL_HALF_WIDTH = Object.freeze('''+json.dumps(samples,separators=(',',':'))+''');\nexport function artistHullHalfWidth(z){\n  const p=ART_HULL_HALF_WIDTH;\n  if(z<=p[0][0])return p[0][1];\n  if(z>=p[p.length-1][0])return p[p.length-1][1];\n  const j=Math.min(p.length-2,Math.max(0,Math.floor((z-p[0][0])/.5)));\n  const a=p[j],b=p[j+1],t=(z-a[0])/(b[0]-a[0]);\n  return a[1]+(b[1]-a[1])*t;\n}\n'''
 Path(a.out).write_text(js)
 print('baked',len(samples),'real hull boundary samples', 'min',min(s[1] for s in samples),'max',max(s[1] for s in samples))
