#!/usr/bin/env python3
"""Topology edit of the user's actual Dutch Ship hull (from the V50 GLB).

A clearance-sized opening is clipped through the existing aft bulkhead using
triangle-plane intersections. The visible hinged leaf reuses the SOURCE door
triangles, vertex normals, UVs and original material; it is scaled from its
lower-left corner, not replaced with a second kit door. Original sail/rigging,
textures and all unaffected hull triangles are preserved byte-for-byte.
"""
import hashlib
import json
import pathlib
import struct
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT/'public/models/stormwake_v50/dutch_ship_cabin_access.glb'
OUT = ROOT/'public/models/stormwake_v52/dutch_ship_passable.glb'
# Author Blender coordinates, BEFORE the unchanged V47 art alignment.
# The portal is the upper-deck aft bulkhead and has an approximately 1.13 x
# 1.08 metre final (game-local) opening; a scaled deck sailor fits beneath it.
HOLE=(-1.365,-0.295,1.635,3.085) # xmin xmax ymin ymax (source coordinates)
SLAB=(-5.77,-5.35)
DOOR_SOURCE_FACES=(6300,6301)
ORIG_LEFT=-1.245
ORIG_BOTTOM=1.964
PIVOT=(-1.365,1.635,-5.578)
LEAF_SCALE=(1.82,1.92,1.0)

b=SRC.read_bytes()
assert b[:4]==b'glTF'
jlen=struct.unpack_from('<I',b,12)[0]
g=json.loads(b[20:20+jlen]);start=20+jlen
assert b[start+4:start+8]==b'BIN\0'
raw=bytearray(b[start+8:])
dtypes={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}
shapes={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}

def data(i):
    a=g['accessors'][i];v=g['bufferViews'][a['bufferView']]
    return np.frombuffer(raw,dtype=dtypes[a['componentType']],count=a['count']*shapes[a['type']],offset=v['byteOffset']+a.get('byteOffset',0)).reshape(-1,shapes[a['type']]).copy()

def append_accessor(arr,target=None):
    arr=np.ascontiguousarray(arr)
    while len(raw)%4:raw.append(0)
    off=len(raw);raw.extend(arr.tobytes());vi=len(g['bufferViews'])
    view={'buffer':0,'byteOffset':off,'byteLength':arr.nbytes}
    if target is not None:view['target']=target
    g['bufferViews'].append(view)
    typ={1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[arr.shape[1]]
    ct=5126 if arr.dtype==np.float32 else 5125
    ac={'bufferView':vi,'componentType':ct,'count':arr.shape[0],'type':typ}
    if arr.shape[0] and typ in ('VEC3', 'SCALAR'):
        ac['min']=arr.min(axis=0).tolist();ac['max']=arr.max(axis=0).tolist()
    ai=len(g['accessors']);g['accessors'].append(ac)
    return ai

p=g['meshes'][0]['primitives'][0]
assert [m['name'] for m in g['meshes']]==['dutch_ship_medium_hull','dutch_ship_medium_rigging','dutch_ship_medium_sails']
positions=data(p['attributes']['POSITION']);normals=data(p['attributes']['NORMAL']);uvs=data(p['attributes']['TEXCOORD_0'])
faces=data(p['indices']).ravel().reshape(-1,3).astype(np.uint32)
original_count=len(faces)
lo,hi,low,high=HOLE
all_out=[];extra_pos=[];extra_n=[];extra_uv=[];modified=0;removed=0

# Each polygon vertex carries [position xyz, normal xyz, uv]. Intersections
# linearly interpolate PBR attributes, so the source wood texture remains intact.
values=np.concatenate((positions,normals,uvs),axis=1)

def clip(poly,axis,threshold,keep_high):
    inside=[];outside=[]
    def valid(v):return v[axis]>=threshold-1e-9 if keep_high else v[axis]<=threshold+1e-9
    for current,nxt in zip(poly,np.roll(poly,-1,axis=0)):
        c=valid(current);n=valid(nxt)
        if c:inside.append(current)
        else:outside.append(current)
        if c!=n:
            d=nxt[axis]-current[axis]
            if abs(d)<1e-13:continue
            t=(threshold-current[axis])/d
            crossing=current+t*(nxt-current)
            # Numerical exact plane coordinate for a watertight slice.
            crossing[axis]=threshold
            inside.append(crossing);outside.append(crossing)
    return inside,outside

def emit(poly):
    if len(poly)<3:return
    # New vertices are used only for clipped polygons; existing unaffected face
    # indices continue pointing to the original source vertex buffers.
    indices=[]
    for v in poly:
        ni=len(positions)+len(extra_pos);indices.append(ni)
        extra_pos.append(v[:3]);extra_n.append(v[3:6]);extra_uv.append(v[6:8])
    for i in range(1,len(indices)-1):
        area=np.linalg.norm(np.cross(np.array(poly[i][:3])-poly[0][:3],np.array(poly[i+1][:3])-poly[0][:3]))
        if area>1e-10:all_out.append((indices[0],indices[i],indices[i+1]))

for i,triangle in enumerate(faces):
    if i in DOOR_SOURCE_FACES:
        removed+=1;continue
    v=positions[triangle];vmin=v.min(axis=0);vmax=v.max(axis=0)
    if not(vmax[0]>lo and vmin[0]<hi and vmax[1]>low and vmin[1]<high and vmin[2]>=SLAB[0] and vmax[2]<=SLAB[1]):
        all_out.append(tuple(map(int,triangle)));continue
    # Clip *only* source bulkhead triangles, not deck slopes/rigging that
    # merely cross the same x/y interval at other longitudinal locations.
    modified+=1
    remaining=[values[triangle]]
    outside=[]
    for axis,threshold,keep_high in [(0,lo,True),(0,hi,False),(1,low,True),(1,high,False)]:
        next_remaining=[]
        for poly in remaining:
            a,rest=clip(np.asarray(poly),axis,threshold,keep_high)
            if len(a)>=3:next_remaining.append(a)
            if len(rest)>=3:outside.append(rest)
        remaining=next_remaining
    for poly in outside:emit(poly)
    if len(remaining):removed+=1

assert modified>30,(modified,removed)
assert removed>=2
assert len(extra_pos)<3000
extra_pos=np.asarray(extra_pos,dtype=np.float32).reshape(-1,3)
extra_n=np.asarray(extra_n,dtype=np.float32).reshape(-1,3)
extra_uv=np.asarray(extra_uv,dtype=np.float32).reshape(-1,2)
all_verts={ 'POSITION':np.vstack((positions,extra_pos)), 'NORMAL':np.vstack((normals,extra_n)), 'TEXCOORD_0':np.vstack((uvs,extra_uv))}
hull_attributes={k:append_accessor(v,34962) for k,v in all_verts.items()}
hull_indices=append_accessor(np.asarray(all_out,dtype=np.uint32).reshape(-1,1),34963)
source_faces=faces[list(DOOR_SOURCE_FACES)]
source_vertex_ids=np.unique(source_faces.ravel())
remap={int(vertex):i for i,vertex in enumerate(source_vertex_ids)}
compact_indices=np.asarray([remap[int(x)] for x in source_faces.ravel()],dtype=np.uint32).reshape(-1,1)
leaf_indices=append_accessor(compact_indices,34963)
leaf_attributes={
    'POSITION':append_accessor(positions[source_vertex_ids],34962),
    'NORMAL':append_accessor(normals[source_vertex_ids],34962),
    'TEXCOORD_0':append_accessor(uvs[source_vertex_ids],34962)
}
p['attributes']=hull_attributes;p['indices']=hull_indices
# Compact exact copies of FOUR ORIGINAL source vertices. Unused hull vertices
# are not in the leaf bounds, preventing inflated frustum/collision bounds.
leaf=dict(p);leaf['attributes']=leaf_attributes
leaf['indices']=leaf_indices
mesh_index=len(g['meshes'])
g['meshes'].append({'name':'Original_Dutch_Door_Resized_From_Source','primitives':[leaf]})
hinge_index=len(g['nodes']);g['nodes'].append({'name':'original_dutch_door_hinge','translation':list(PIVOT),'children':[hinge_index+1]})
g['nodes'].append({'name':'original_dutch_door_leaf','mesh':mesh_index,'translation':[-ORIG_LEFT*LEAF_SCALE[0],-ORIG_BOTTOM*LEAF_SCALE[1],5.578],'scale':list(LEAF_SCALE)})
for scene in g['scenes']:scene['nodes'].append(hinge_index)
g['buffers'][0]['byteLength']=len(raw)
g['asset']['generator']='STORMWAKE V52 Dutch source-mesh aperture clipping + re-scaled original door'
j=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode();j+=b' '*((4-len(j)%4)%4)
raw+=b'\0'*((4-len(raw)%4)%4)
blob=b'glTF'+struct.pack('<II',2,12+8+len(j)+8+len(raw))+struct.pack('<I',len(j))+b'JSON'+j+struct.pack('<I',len(raw))+b'BIN\0'+raw
OUT.parent.mkdir(exist_ok=True,parents=True);OUT.write_bytes(blob)
manifest={'source':str(SRC.relative_to(ROOT)),'output':str(OUT.relative_to(ROOT)),
    'sha256':hashlib.sha256(blob).hexdigest(),'source_triangles':original_count,
    'bulkhead_triangles_intersected':modified,'fully_removed_faces':removed,
    'new_hull_triangles':len(all_out),'new_split_vertices':len(extra_pos),
    'door_source_faces':DOOR_SOURCE_FACES,'door_source_vertex_ids':source_vertex_ids.tolist(),'hole_author_coordinates':HOLE,
    'door_scale':LEAF_SCALE,'retained_materials':len(g['materials']),
    'retained_textures':len(g['textures'])}
(OUT.parent/'asset_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest,indent=2))
