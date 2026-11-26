"""Articulate the bundled Kenney CC0 cannon at its actual barrel axis.
Original vertices, UVs, textures and triangle winding are retained verbatim.
"""
from pathlib import Path
import struct,json,io,collections,copy
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'public/models/stormwake_v62/kenney_cannon.glb'
b=source.read_bytes();n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n]);base=20+n+8;binary=bytearray(b[base:base+struct.unpack_from('<I',b,20+n)[0]])
def accessor(i,dim):
 a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];fmt={5126:'f',5123:'H',5125:'I',5121:'B'}[a['componentType']];off=v.get('byteOffset',0)+a.get('byteOffset',0);return list(struct.iter_unpack('<'+fmt*dim,binary[off:off+a['count']*dim*struct.calcsize(fmt)]))
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

barrel=[];carriage=[]
for faces in groups.values():
 ids={i for f in faces for i in f};span=[max(pos[i][a]for i in ids)-min(pos[i][a]for i in ids)for a in range(3)]
 target=barrel if span[2]>1.8 and span[1]>.8 else carriage
 target.extend(i for f in faces for i in f)
assert len(barrel)==420 and len(carriage)==168

def append_indices(values):
 while len(binary)%4:binary.append(0)
 off=len(binary);binary.extend(struct.pack('<'+'H'*len(values),*values));d['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(values)*2,'target':34963});d['accessors'].append({'bufferView':len(d['bufferViews'])-1,'componentType':5123,'count':len(values),'type':'SCALAR'});return len(d['accessors'])-1
base_mesh=copy.deepcopy(p);base_mesh['indices']=append_indices(carriage);d['meshes'][0]['primitives']=[base_mesh]
barrel_mesh=copy.deepcopy(p);barrel_mesh['indices']=append_indices(barrel);d['meshes'].append({'name':'CannonBarrel','primitives':[barrel_mesh]})
axis_y=(.23535245656967163+1.0546623468399048)/2
pivot=len(d['nodes']);d['nodes'][0]['children'].append(pivot)
d['nodes'].extend([{'name':'CannonBarrelPitch','translation':[0,axis_y,0],'children':[pivot+1,pivot+2]},{'name':'OriginalBarrelGeometry','translation':[0,-axis_y,0],'mesh':len(d['meshes'])-1},{'name':'CannonMuzzle','translation':[0,0,.9906570911407471]}])
d['buffers'][0]['byteLength']=len(binary);d['asset']['extras']={'license':'CC0','source':'Bundled Kenney Pirate Kit cannon','modification':'V63 separates the 140 original barrel triangles from the stationary carriage; source UVs, vertices, wheel meshes and original rest pose retained'}
j=json.dumps(d,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary+=b'\0'*((-len(binary))%4)
out=ROOT/'public/models/stormwake_v63/cannon_articulated.glb';out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary)
print(json.dumps({'barrelTriangles':len(barrel)//3,'carriageTriangles':len(carriage)//3,'barrelAxisY':axis_y,'muzzleZ':.9906570911407471,'output':str(out.relative_to(ROOT))}))
