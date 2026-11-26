"""Split the bundled CC0 ship into opaque timber and separate sewn cloth.
Original vertices, UVs, textures and triangle winding are retained verbatim.
"""
from pathlib import Path
import struct,json,io,collections,copy
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'public/models/stormwake_v47/quaternius_ship_large.glb'
b=source.read_bytes();n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n]);base=20+n+8;binary=bytearray(b[base:base+struct.unpack_from('<I',b,20+n)[0]])
def accessor(i,dim):
 a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];fmt={5126:'f',5123:'H',5125:'I'}[a['componentType']];off=v.get('byteOffset',0)+a.get('byteOffset',0);return list(struct.iter_unpack('<'+fmt*dim,binary[off:off+a['count']*dim*struct.calcsize(fmt)]))
p=d['meshes'][0]['primitives'][0];pos=accessor(p['attributes']['POSITION'],3);uv=accessor(p['attributes']['TEXCOORD_0'],2);indices=[v[0]for v in accessor(p['indices'],1)];parent=list(range(len(pos)))
def root(i):
 while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
 return i
seen={}
for i,v in enumerate(pos):
 k=tuple(round(x,4)for x in v)
 if k in seen:parent[root(i)]=root(seen[k])
 else:seen[k]=i
for i in range(0,len(indices),3):
 for j in indices[i+1:i+3]:parent[root(j)]=root(indices[i])
groups=collections.defaultdict(list)
for i in range(0,len(indices),3):groups[root(indices[i])].append(indices[i:i+3])
image=d['images'][0];view=d['bufferViews'][image['bufferView']];offset=view.get('byteOffset',0);atlas=Image.open(io.BytesIO(binary[offset:offset+view['byteLength']])).convert('RGB')
def color(face):
 u=sum(uv[j][0]for j in face)/3;v=sum(uv[j][1]for j in face)/3;return atlas.getpixel((min(atlas.width-1,max(0,int(u*atlas.width))),min(atlas.height-1,max(0,int(v*atlas.height)))))
hull=[];cloth=[];panels=[]
for faces in groups.values():
 ids={i for f in faces for i in f};bounds=[(min(pos[i][a]for i in ids),max(pos[i][a]for i in ids))for a in range(3)];span=[b-a for a,b in bounds];palette=collections.Counter(color(f)for f in faces);fabric=sum(palette[c]for c in [(168,154,106),(199,199,199),(139,30,31)])
 sewn=span[1]>1 and max(span[0],span[2])>1.2 and min(span[0],span[2])<1.3 and fabric>=len(faces)*.65
 target=cloth if sewn else hull;target.extend(i for f in faces for i in f)
 if sewn:panels.append({'triangles':len(faces),'bounds':bounds})
assert len(cloth)>120 and len(cloth)<len(indices)*.3,(len(cloth),len(indices),panels)
def append_indices(values):
 while len(binary)%4:binary.append(0)
 off=len(binary);binary.extend(struct.pack('<'+'I'*len(values),*values));d['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(values)*4,'target':34963});d['accessors'].append({'bufferView':len(d['bufferViews'])-1,'componentType':5125,'count':len(values),'type':'SCALAR'});return len(d['accessors'])-1
body=copy.deepcopy(p);body['indices']=append_indices(hull);body['material']=0;sail=copy.deepcopy(p);sail['indices']=append_indices(cloth);sail['material']=1;d['meshes'][0]['primitives']=[body,sail]
opaque=copy.deepcopy(d['materials'][0]);opaque['name']='GhostHullOpaque';opaque['alphaMode']='OPAQUE';canvas=copy.deepcopy(opaque);canvas['name']='GhostCanvas';canvas['alphaMode']='BLEND';canvas['doubleSided']=True;d['materials']=[opaque,canvas];d['buffers'][0]['byteLength']=len(binary);d['asset']['extras']={'source':'Bundled Quaternius Ships Pack','license':'CC0','modification':'V63: disconnected sewn canvas primitives separated; all original geometry and atlas retained'}
j=json.dumps(d,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary+=b'\0'*((-len(binary))%4);out=ROOT/'public/models/stormwake_v63/ghost_ship_separated.glb';out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary)
report={'source':str(source.relative_to(ROOT)),'output':str(out.relative_to(ROOT)),'hullTriangles':len(hull)//3,'clothTriangles':len(cloth)//3,'panels':panels};(out.parent/'ghost_ship_derivation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
