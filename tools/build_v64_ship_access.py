"""Clip only measured stair retrofit volumes from the CC0 Dutch GLB.
Preserve unaffected indices, PBR UVs, normals, rigging and material metadata.
"""
import hashlib,json,struct
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'public/models/stormwake_v54/dutch_ship_lower_hold.glb'
OUT=ROOT/'public/models/stormwake_v64/dutch_ship_lower_hold.glb'
raw=SOURCE.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
g=json.loads(raw[20:20+size]);blob=bytearray(raw[28+size:])
def read(index):
 a=g['accessors'][index];v=g['bufferViews'][a['bufferView']]
 count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
 return np.frombuffer(blob,dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']],count=a['count']*count,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,count).copy()
def append(a,target):
 a=np.ascontiguousarray(a);blob.extend(b'\0'*((-len(blob))%4));offset=len(blob);blob.extend(a.tobytes())
 vi=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':a.nbytes,'target':target})
 ai=len(g['accessors']);g['accessors'].append({'bufferView':vi,'componentType':5126 if a.dtype==np.float32 else 5125,'count':len(a),'type':{1:'SCALAR',2:'VEC2',3:'VEC3'}[a.shape[1]],'min':a.min(axis=0).tolist(),'max':a.max(axis=0).tolist()});return ai
def clip(poly,axis,plane,high):
 inside=[];outside=[]
 for a,b in zip(poly,np.roll(poly,-1,axis=0)):
  ia=a[axis]>=plane if high else a[axis]<=plane;ib=b[axis]>=plane if high else b[axis]<=plane
  (inside if ia else outside).append(a)
  if ia!=ib:
   p=a+(b-a)*(plane-a[axis])/(b[axis]-a[axis]);p[axis]=plane;inside.append(p);outside.append(p)
 return inside,outside
# Bounds are defined in the aligned metric boat frame, including head clearance.
cuts=[{'id':'aft','min':[.51,.94,-7.29],'max':[1.55,3.02,-5.50]}, {'id':'fore','min':[.51,.81,1.82],'max':[1.55,2.94,3.68]},
 {'id':'aft_upper_landing','min':[.51,2.02,-7.70],'max':[1.55,3.85,-7.29]},
 {'id':'aft_lower_landing','min':[.51,1.20,-5.50],'max':[1.55,2.94,-5.05]},
 {'id':'fore_upper_landing','min':[.51,1.98,3.68],'max':[1.55,3.75,4.10]},
 {'id':'fore_lower_landing','min':[.51,1.07,1.42],'max':[1.55,2.94,1.82]},
 {'id':'cabin_sunken_approach','min':[-1.32,.87,-6.86],'max':[-.44,1.30,-5.84]},
 {'id':'fore_well_port','min':[.32,1.50,5.50],'max':[1.32,3.85,6.82]},
 {'id':'fore_well_starboard','min':[-1.32,1.50,5.50],'max':[-.32,3.85,6.82]}]
for cut in cuts:
 for key in ('min','max'):
  x,y,z=cut[key];cut[key]=[x/1.064,(y+.4)/.75,(z+.7)/1.064]
p=g['meshes'][0]['primitives'][0]
attributes={k:read(a) for k,a in p['attributes'].items()};keys=list(attributes)
assert keys==['POSITION','NORMAL','TEXCOORD_0'],keys
values=np.concatenate(list(attributes.values()),axis=1);faces=read(p['indices']).reshape(-1,3)
new=[];affected=0
for face in faces:
 polygons=[values[face]]
 for cut in cuts:
  survivors=[]
  for poly in polygons:
   if any(poly[:,a].max()<=cut['min'][a] or poly[:,a].min()>=cut['max'][a] for a in range(3)):
    survivors.append(poly);continue
   affected+=1;remaining=[poly]
   for axis in range(3):
    for plane,high in [(cut['min'][axis],True),(cut['max'][axis],False)]:
     next_polys=[]
     for part in remaining:
      inner,outer=clip(np.asarray(part),axis,plane,high)
      if len(outer)>=3:survivors.append(np.asarray(outer))
      if len(inner)>=3:next_polys.append(np.asarray(inner))
     remaining=next_polys
   # Polygons remaining inside the opening are replaced by visible stair treads.
  polygons=survivors
 for poly in polygons:
  for i in range(1,len(poly)-1):
   tri=np.asarray([poly[0],poly[i],poly[i+1]])
   if np.linalg.norm(np.cross(tri[1,:3]-tri[0,:3],tri[2,:3]-tri[0,:3]))>1e-10:new.extend(tri)
assert affected>0
v=np.asarray(new,dtype=np.float32);normal=v[:,3:6];normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-8)
p['attributes']={'POSITION':append(v[:,:3],34962),'NORMAL':append(normal,34962),'TEXCOORD_0':append(v[:,6:8],34962)}
p['indices']=append(np.arange(len(v),dtype=np.uint32).reshape(-1,1),34963)
g['buffers'][0]['byteLength']=len(blob);g['asset']['generator']='STORMWAKE V62 CC0 Dutch measured stair aperture retrofit'
encoded=json.dumps(g,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);blob.extend(b'\0'*((-len(blob))%4))
out=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(blob))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(blob),b'BIN\0')+blob
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_bytes(out)
manifest={'source':str(SOURCE.relative_to(ROOT)),'source_sha256':hashlib.sha256(raw).hexdigest(),'file':str(OUT.relative_to(ROOT)),'sha256':hashlib.sha256(out).hexdigest(),'license':'CC0 Poly Haven Dutch Ship Medium','affected_polygon_tests':affected,'output_triangles':len(v)//3,'cut_volumes_author_space':cuts,'replacement':'src/ship/ShipStairs.js','limitations':'This is a documented local stair retrofit, not a new hull.'}
(OUT.parent/'stair_manifest_v64.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'affected':affected,'triangles':len(v)//3,'bytes':len(out)}))
