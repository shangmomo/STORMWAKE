#!/usr/bin/env python3
"""Read actual original hull vertices; use the maximum hull outer sides for boarding."""
from pathlib import Path
import numpy as np,trimesh,json
root=Path(__file__).resolve().parents[2]
g=trimesh.load(root/'public/models/stormwake_v47/dutch_ship_medium_pbr.glb',force='scene').geometry['dutch_ship_medium_hull']
v=g.vertices;x=abs(v[:,0]*1.064);y=v[:,1]*.75-.40;z=v[:,2]*1.064-.70
samples=[]
for at in np.arange(-11.5,12.01,.25):
 sel=(abs(z-at)<.40)&(y>-.62)&(y<2.65)
 subset=x[sel]
 w=float(np.quantile(subset,.985)) if len(subset)>=12 else None
 samples.append([round(float(at),2),round(w,3) if w is not None else None])
good=np.array([(u,w) for u,w in samples if w is not None]);
for item in samples:
 if item[1] is None:item[1]=round(float(np.interp(item[0],good[:,0],good[:,1])),3)
Path(root/'src/ship/DutchHullOuterProfile.js').write_text('''// Baked from the original, uncut Poly Haven Dutch hull triangles.\nexport const DUTCH_OUTER_WIDTH = Object.freeze('''+json.dumps(samples,separators=(',',':'))+''');
export function outerHalfWidth(z){
 const a=DUTCH_OUTER_WIDTH;
 if(z<=a[0][0])return a[0][1];if(z>=a.at(-1)[0])return a.at(-1)[1];
 const j=Math.min(a.length-2,Math.max(0,Math.floor((z-a[0][0])/.25)));
 const p=a[j],q=a[j+1],t=(z-p[0])/(q[0]-p[0]);
 return p[1]+(q[1]-p[1])*t;
}
''')
print('Original hull outer profile',len(samples),'samples',min(v[1] for v in samples),max(v[1] for v in samples))
