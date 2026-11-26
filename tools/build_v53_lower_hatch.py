#!/usr/bin/env python3
"""Remove original Dutch main-deck triangles inside a main hold hatch.

All geometry outside the aperture keeps the original source positions, normals,
UVs and material.  This is not an invisible hole mask or a fake overlay deck.
"""
import pathlib, struct, json, hashlib
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'public/models/stormwake_v52/dutch_ship_passable.glb'
OUTPUT=ROOT/'public/models/stormwake_v53/dutch_ship_lower_hold.glb'
# Original Blender/glTF coordinates (alignment: x*1.064, y*.75-.4, z*1.064-.7).
# In-game main deck hatch x[-.64,.64], z[-4.12,-3.18].
X0,X1=-.602,.602
Z0,Z1=(-4.12+.7)/1.064,(-3.18+.7)/1.064
b=SOURCE.read_bytes();jlen=struct.unpack_from('<I',b,12)[0]
g=json.loads(b[20:20+jlen]);raw=bytearray(b[28+jlen:]);assert b[:4]==b'glTF'
formats={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}
dims={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
def read(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']]
 return np.frombuffer(raw,dtype=formats[a['componentType']],count=a['count']*dims[a['type']],offset=v['byteOffset']+a.get('byteOffset',0)).reshape(-1,dims[a['type']]).copy()
def append(array,target):
 array=np.ascontiguousarray(array);raw.extend(b'\0'*((-len(raw))%4));off=len(raw);raw.extend(array.tobytes())
 view=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':array.nbytes,'target':target})
 accessor=len(g['accessors']);d={'bufferView':view,'componentType':5126 if array.dtype==np.float32 else 5125,'count':len(array),'type':{1:'SCALAR',2:'VEC2',3:'VEC3'}[array.shape[1]]}
 if len(array):d['min']=array.min(axis=0).tolist();d['max']=array.max(axis=0).tolist()
 g['accessors'].append(d);return accessor
prim=g['meshes'][0]['primitives'][0];at=prim['attributes']
pos=read(at['POSITION']);normal=read(at['NORMAL']);uv=read(at['TEXCOORD_0']);faces=read(prim['indices']).astype(np.uint32).reshape(-1,3)
values=np.concatenate((pos,normal,uv),axis=1)
newP=[];newN=[];newUV=[];output=[];removed=0;split=0

def cut(poly,axis,limit,positive):
 inside=[];outside=[]
 valid=lambda v:v[axis]>=limit-1e-8 if positive else v[axis]<=limit+1e-8
 for a,bb in zip(poly,np.roll(poly,-1,axis=0)):
  aa=valid(a);bvalid=valid(bb)
  (inside if aa else outside).append(a)
  if aa!=bvalid:
   t=(limit-a[axis])/(bb[axis]-a[axis]);p=a+t*(bb-a);p[axis]=limit
   inside.append(p);outside.append(p)
 return np.asarray(inside),np.asarray(outside)

def emit(poly):
 if len(poly)<3:return
 ids=[]
 for p in poly:
  ids.append(len(pos)+len(newP));newP.append(p[:3]);newN.append(p[3:6]);newUV.append(p[6:8])
 for k in range(1,len(ids)-1):
  area=np.linalg.norm(np.cross(poly[k][:3]-poly[0][:3],poly[k+1][:3]-poly[0][:3]))
  if area>1e-9:output.append((ids[0],ids[k],ids[k+1]))
for triangle in faces:
 t=pos[triangle];lo=t.min(axis=0);hi=t.max(axis=0)
 n=np.cross(t[1]-t[0],t[2]-t[0]);ny=abs(n[1])/max(1e-8,np.linalg.norm(n))
 # Only cut the horizontal original *main deck*. Do not remove existing hull,
 # parapets, decorative fittings, bulwarks, or keel and lower inner faces.
 if not(hi[0]>X0 and lo[0]<X1 and hi[2]>Z0 and lo[2]<Z1 and lo[1]>1.48 and hi[1]<2.01 and ny>.72):
  output.append(tuple(map(int,triangle)));continue
 split+=1
 inside=[values[triangle]];outs=[]
 for axis,limit,positive in ((0,X0,True),(0,X1,False),(2,Z0,True),(2,Z1,False)):
  rest=[]
  for poly in inside:
   keep,leave=cut(poly,axis,limit,positive)
   if len(keep)>=3:rest.append(keep)
   if len(leave)>=3:outs.append(leave)
  inside=rest
 for polygon in outs:emit(polygon)
 if len(inside):removed+=1
assert split>=2 and removed>=2,(split,removed)
prim['attributes']={k:append(np.concatenate((data,np.asarray(extra,dtype=np.float32).reshape(-1,data.shape[1]))),34962) for k,data,extra in [('POSITION',pos,newP),('NORMAL',normal,newN),('TEXCOORD_0',uv,newUV)]}
prim['indices']=append(np.asarray(output,dtype=np.uint32).reshape(-1,1),34963)
g['buffers'][0]['byteLength']=len(raw);g['asset']['generator']='STORMWAKE V53 source mesh original main deck topological aperture'
j=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
raw+=b'\0'*((-len(raw))%4)
blob=b'glTF'+struct.pack('<II',2,20+len(j)+8+len(raw))+struct.pack('<I',len(j))+b'JSON'+j+struct.pack('<I',len(raw))+b'BIN\0'+raw
OUTPUT.parent.mkdir(parents=True,exist_ok=True);OUTPUT.write_bytes(blob)
info={'source':str(SOURCE.relative_to(ROOT)),'file':str(OUTPUT.relative_to(ROOT)),'sha256':hashlib.sha256(blob).hexdigest(),'source_triangles':len(faces),'horizontal_deck_faces_examined':split,'hatch_faces_removed':removed,'output_triangles':len(output),'new_split_vertices':len(newP),'source_hatch_xy_z':[X0,X1,Z0,Z1]}
(OUTPUT.parent/'hatch_manifest.json').write_text(json.dumps(info,indent=2,ensure_ascii=False),encoding='utf-8');print(json.dumps(info,indent=2))
