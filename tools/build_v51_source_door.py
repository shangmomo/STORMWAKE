"""Split the actual Dutch-hull's closed forward-bulkhead door skin.
No new vertices, meshes, textures, or substitute door are modelled. Source V50
has three monolithic GLB meshes; two triangles (the original flat wood panel)
are moved into a hinged child node. Surrounding source frame is left untouched.
"""
import json,struct,pathlib,hashlib
import numpy as np
root=pathlib.Path(__file__).resolve().parents[1]
src=root/'public/models/stormwake_v50/dutch_ship_cabin_access.glb'
dst=root/'public/models/stormwake_v51/dutch_ship_operable.glb'
data=src.read_bytes()
assert data[:4]==b'glTF' and struct.unpack_from('<I',data,4)[0]==2
json_len=struct.unpack_from('<I',data,12)[0]
g=json.loads(data[20:20+json_len]);bin_offset=20+json_len
assert data[bin_offset+4:bin_offset+8]==b'BIN\0'
binary=bytearray(data[bin_offset+8:])
types={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}
def read_accessor(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];size={'SCALAR':1,'VEC3':3}[a['type']]
 return np.frombuffer(binary,dtype=types[a['componentType']],count=a['count']*size,offset=v['byteOffset']+a.get('byteOffset',0)).reshape(-1,size).copy()
assert [m['name'] for m in g['meshes']]==['dutch_ship_medium_hull','dutch_ship_medium_rigging','dutch_ship_medium_sails']
p=g['meshes'][0]['primitives'][0]
positions=read_accessor(p['attributes']['POSITION'])
faces=read_accessor(p['indices']).astype(np.uint32).reshape(-1,3)
tri=positions[faces]
center=tri.mean(axis=1)
# Reviewed in original authored x/y/z coordinates: the 0.60 x 0.75 m
# closed left door panel at the existing forward sterncastle bulkhead.
# These are original wood door polygons 6300+6301; side jamb remains in hull.
selector=(center[:,0] < -0.75)&(center[:,0]>-1.17)&(center[:,1]>2.1)&(center[:,1]<2.63)&(center[:,2]>-5.60)&(center[:,2]<-5.55)
chosen=np.flatnonzero(selector)
assert chosen.tolist()==[6300,6301],chosen.tolist()
old=faces[~selector].astype(np.uint32).reshape(-1)
door=faces[selector].astype(np.uint32).reshape(-1)
# Reuse ALL original vertex data, UVs, normals, textures, and materials.
def new_index_accessor(indices):
 while len(binary)%4:binary.append(0)
 start=len(binary);binary.extend(indices.tobytes());view=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':indices.nbytes,'target':34963})
 accessor=len(g['accessors']);g['accessors'].append({'bufferView':view,'componentType':5125,'count':len(indices),'type':'SCALAR','min':[int(indices.min())],'max':[int(indices.max())]})
 return accessor
old_acc=new_index_accessor(old);door_acc=new_index_accessor(door)
p['indices']=old_acc
leaf=dict(p);leaf['indices']=door_acc
mesh_index=len(g['meshes']);g['meshes'].append({'name':'Original_Dutch_Bulkhead_Door_Skin','primitives':[leaf]})
# A GLB node is the door's real hinge; runtime rotates this source-only leaf.
# Child's opposite translation cancels hinge offset when the door is closed.
pivot=(-1.245,0,-5.578)
hinge=len(g['nodes']);g['nodes'].append({'name':'original_dutch_door_hinge','translation':list(pivot),'children':[hinge+1]})
g['nodes'].append({'name':'original_dutch_door_leaf','mesh':mesh_index,'translation':[-pivot[0],-pivot[1],-pivot[2]]})
for scene in g['scenes']:scene['nodes'].append(hinge)
g['buffers'][0]['byteLength']=len(binary)
g['asset']['generator']='STORMWAKE V51 source door split: original Dutch asset, original UV and material'
text=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode()
text+=b' ' * ((4-len(text)%4)%4)
binary+=b'\x00'*((4-len(binary)%4)%4)
result=b'glTF'+struct.pack('<II',2,12+8+len(text)+8+len(binary))+struct.pack('<I',len(text))+b'JSON'+text+struct.pack('<I',len(binary))+b'BIN\x00'+binary
dst.write_bytes(result)
manifest=[{'file':dst.name,'bytes':len(result),'sha256':hashlib.sha256(result).hexdigest(),'source':src.name,'movable_original_faces':chosen.tolist()}]
(dst.parent/'asset_manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Created original mesh door:',dst.name,len(result),'faces',len(door)//3,'original hull faces',len(old)//3)
