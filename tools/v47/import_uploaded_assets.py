#!/usr/bin/env python3
"""Reproducible asset importer for the user-provided CC0 Dutch Ship .blend and CC0 kits.
Blender file is a binary mesh source; this script reads Blender 3.0 DNA data
for the 3 mesh objects, triangulates polygons, and embeds 2K PBR maps in GLB.
No Blender installation, shell scripts, paid SDKs, or external downloads required.
Usage: python tools/v47/import_uploaded_assets.py --dutch ZIP --kenney ZIP --quaternius ZIP --out public/models/stormwake_v47
"""
import argparse,base64,collections,hashlib,io,json,os,re,struct,subprocess,tempfile,zipfile
from functools import lru_cache
from pathlib import Path
import numpy as np
from PIL import Image

class Blend:
 def __init__(self,src):
  if not src.startswith(b'BLENDER'):
   if src[:4]==b'\x28\xb5\x2f\xfd':
    proc=subprocess.run(['zstd','-q','-d','-c'],input=src,capture_output=True)
    if proc.returncode: raise RuntimeError('Compressed Blender needs zstd: '+proc.stderr.decode())
    src=proc.stdout
   else:raise ValueError('Unsupported Blender data, expected BLENDER or Zstandard header')
  self.buf=src
  assert src[:7]==b'BLENDER'
  self.ptr=8 if src[7:8]==b'-' else 4;self.byteorder='<' if src[8:9]==b'v' else '>'
  if self.ptr!=8 or self.byteorder!='<':raise ValueError('Importer supports Blender 3.0 little-endian 64-bit blend files')
  self.blocks=[];self.byaddr={};i=12
  while i<len(src):
   code=src[i:i+4].split(b'\x00')[0].decode('latin1');size=struct.unpack_from('<I',src,i+4)[0];addr=struct.unpack_from('<Q',src,i+8)[0]
   sdna,count=struct.unpack_from('<II',src,i+16)
   block={'code':code,'size':size,'addr':addr,'sdna':sdna,'count':count,'pos':i+24}
   self.blocks.append(block)
   if addr:self.byaddr[addr]=block
   i+=24+size
   if code=='ENDB':break
  block=next(a for a in self.blocks if a['code']=='DNA1');dna=src[block['pos']:block['pos']+block['size']];i=4
  def section(tag):
   nonlocal i
   if dna[i:i+4]!=tag:raise ValueError('Missing DNA section '+tag.decode())
   i+=4
  def read_names():
   nonlocal i
   n=struct.unpack_from('<I',dna,i)[0];i+=4;ans=[]
   for _ in range(n):
    q=dna.index(0,i);ans.append(dna[i:q].decode('latin1'));i=q+1
   i=(i+3)//4*4;return ans
  section(b'NAME');names=read_names();section(b'TYPE');types=read_names()
  section(b'TLEN');tlen=struct.unpack_from('<'+str(len(types))+'H',dna,i);i+=len(types)*2;i=(i+3)//4*4
  section(b'STRC');n=struct.unpack_from('<I',dna,i)[0];i+=4;self.st={};self.lengths=dict(zip(types,tlen))
  for _ in range(n):
   t,k=struct.unpack_from('<HH',dna,i);i+=4;fields=[]
   for j in range(k):
    ft,fn=struct.unpack_from('<HH',dna,i);i+=4;fields.append((types[ft],names[fn]))
   self.st[types[t]]=(tlen[t],fields)
  self._layout_cache={}
 def layout(self,t):
  if t in self._layout_cache:return self._layout_cache[t]
  fields=self.st[t][1];pos=0;ls={}
  for ft,fn in fields:
   align=8 if fn.startswith('*') or (ft in self.st and self.st[ft][0]%8==0) else min(4,self.lengths.get(ft,4))
   pos=(pos+align-1)//align*align
   size=(8 if fn.startswith('*') else self.lengths[ft]);multiple=1
   for d in re.findall(r'\[(\d+)\]',fn):multiple*=int(d)
   ls[fn]=pos;pos+=size*multiple
  if pos>self.st[t][0]:raise ValueError(f'Blender layout exceeds struct: {t} {pos}>{self.st[t][0]}')
  self._layout_cache[t]=ls;return ls
 def at(self,block,typename,field):return block['pos']+self.layout(typename)[field]
 def int(self,p):return struct.unpack_from('<i',self.buf,p)[0]
 def pointer(self,p):return struct.unpack_from('<Q',self.buf,p)[0]
 def blockfor(self,p):
  if p not in self.byaddr:raise ValueError('Blender broken mesh pointer: '+hex(p))
  return self.byaddr[p]
 def cstr(self,p,n=64):return self.buf[p:p+n].split(b'\0')[0].decode('utf-8','replace')
 def names(self):return [self.cstr(a['pos']+40,66)[2:] for a in self.blocks if a['code']=='OB']
 def meshes(self):
  dtv=np.dtype([('xyz','<f4',(3,)),('normal','<i2',(3,)),('flag','u1'),('weight','u1')]);
  dtl=np.dtype([('v','<i4'),('e','<i4')]);dtuv=np.dtype([('uv','<f4',(2,)),('flag','<i4')]);
  dtp=np.dtype([('start','<i4'),('count','<i4'),('mat','<i2'),('flag','u1'),('pad','u1')]);
  for ob in [a for a in self.blocks if a['code']=='OB']:
   name=self.cstr(ob['pos']+40)[2:];mesh=self.blockfor(self.pointer(self.at(ob,'Object','*data')))
   qty={q:self.int(self.at(mesh,'Mesh','tot'+q)) for q in ('vert','loop','poly')}
   def arr(field,dtype,n):
    a=self.blockfor(self.pointer(self.at(mesh,'Mesh',field)))
    if a['size']<n*dtype.itemsize:raise ValueError('Mesh buffer truncated: '+name+' '+field)
    return np.frombuffer(self.buf,dtype=dtype,count=n,offset=a['pos'])
   verts=arr('*mvert',dtv,qty['vert']);loops=arr('*mloop',dtl,qty['loop']);uvs=arr('*mloopuv',dtuv,qty['loop']);polys=arr('*mpoly',dtp,qty['poly'])
   yield name,verts,loops,uvs,polys

def make_glb(doc,blob):
 jb=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode();jb+=b' ' * (-len(jb)%4)
 bb=bytes(blob)+b'\x00'*(-len(blob)%4)
 return struct.pack('<4sII',b'glTF',2,12+8+len(jb)+8+len(bb))+struct.pack('<I4s',len(jb),b'JSON')+jb+struct.pack('<I4s',len(bb),b'BIN\0')+bb

class GLB:
 def __init__(self):
  self.doc={'asset':{'version':'2.0','generator':'STORMWAKE V47 Blender DNA converter'},'scene':0,'scenes':[{'nodes':[]}], 'nodes':[],'meshes':[],'materials':[],'accessors':[],'bufferViews':[],'buffers':[{'byteLength':0}],'images':[],'textures':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]}
  self.blob=bytearray()
 def store(self,data):
  while len(self.blob)%4:self.blob.append(0)
  idx=len(self.doc['bufferViews']);self.doc['bufferViews'].append({'buffer':0,'byteOffset':len(self.blob),'byteLength':len(data)});self.blob.extend(data);return idx
 def accessor(self,array,component,type_,minimum=None,maximum=None):
  v=self.store(np.ascontiguousarray(array).tobytes());idx=len(self.doc['accessors'])
  d={'bufferView':v,'componentType':component,'count':len(array),'type':type_}
  if minimum is not None:d['min']=[float(i) for i in minimum];d['max']=[float(i) for i in maximum]
  self.doc['accessors'].append(d);return idx
 def image(self,data,mime,name):
  i=len(self.doc['images']);self.doc['images'].append({'name':name,'bufferView':self.store(data),'mimeType':mime});self.doc['textures'].append({'sampler':0,'source':i});return len(self.doc['textures'])-1
 def finish(self):
  self.doc['buffers'][0]['byteLength']=len(self.blob);return make_glb(self.doc,self.blob)

def texdata(zipfile_obj,fn,size=2048,kind='rgb',alpha=None):
 with zipfile_obj.open('textures/'+fn) as fi: im=Image.open(fi);im.load()
 im=im.convert('RGB')
 if max(im.size)>size: im.thumbnail((size,size),Image.Resampling.LANCZOS)
 if alpha:
  with zipfile_obj.open('textures/'+alpha) as fi: al=Image.open(fi).convert('L');al.load()
  al=al.resize(im.size,Image.Resampling.LANCZOS)
  im.putalpha(al)
 if kind=='orm':
  # separate roughness and metalness textures are packed later
  pass
 o=io.BytesIO();fmt='PNG' if alpha else 'JPEG'
 if fmt=='JPEG': im.save(o,format=fmt,quality=90,subsampling=0,optimize=True)
 else: im.save(o,format=fmt,optimize=True)
 return o.getvalue(),('image/png' if alpha else 'image/jpeg')

def ormdata(z,group,size=2048):
 def opench(suffix):
  path=f'textures/dutch_ship_medium_{group}_{suffix}_4k.png'
  if path not in z.namelist():return Image.new('L',(size,size),0)
  with z.open(path) as file:
   im=Image.open(file).convert('L');im.load()
  if im.width>size:im=im.resize((size,size),Image.Resampling.LANCZOS)
  return im
 rough=opench('rough');metal=opench('metal');r=Image.new('L',rough.size,255)
 a=Image.merge('RGB',(r,rough,metal));o=io.BytesIO();a.save(o,'JPEG',quality=91,subsampling=0,optimize=True)
 return o.getvalue()

def cut_hatch_faces(pos,norm,uv,triangles):
 """Cut an actual rectangular hatch through only Dutch hull deck/cabin horizontal
 boards. Uses convex polygon splitting in X/Z, interpolates UV and normals,
 and preserves all outside fragments. Does NOT alter vertical hull plates.
 Native glTF frame: X beam, Y up, Z forward (before artist alignment).
 """
 bounds=(-1.035,1.035,-4.52,-1.68) # phys ~x±1.1, deck z≈-4±1.5
 def splitpoly(poly, axis, val, positive):
  keep=[];other=[]
  if not poly:return keep,other
  for aa,bb in zip(poly,poly[1:]+poly[:1]):
   da=(aa[axis]-val)*(1 if positive else -1);db=(bb[axis]-val)*(1 if positive else -1)
   if da>=-1e-7:keep.append(aa)
   else:other.append(aa)
   if (da>1e-7 and db<-1e-7) or (da<-1e-7 and db>1e-7):
    t=da/(da-db);n=aa+(bb-aa)*t;keep.append(n);other.append(n)
  return keep,other
 newpos=[x.tolist() for x in pos];newnor=[x.tolist() for x in norm];newuv=[x.tolist() for x in uv];output=[]
 changed=0;deleted=0
 # Outside rectangle is union of x<left, x>right, z<back, z>front.
 # Clip remaining inside region sequentially to avoid overlapping fragments.
 for ti in range(0,len(triangles),3):
  ids=triangles[ti:ti+3];p=pos[ids];
  if p[:,0].max()<bounds[0] or p[:,0].min()>bounds[1] or p[:,2].max()<bounds[2] or p[:,2].min()>bounds[3]:
   output.extend(ids);continue
  n=np.cross(p[1]-p[0],p[2]-p[0]);ln=np.linalg.norm(n)
  if ln<1e-7 or abs(n[1]/ln)<.65 or not (1.65<=p[:,1].mean()<=3.85):
   output.extend(ids);continue
  verts=[np.concatenate([pos[j],norm[j],uv[j]]) for j in ids]
  candidates=[verts];kept=[]
  # keep planes for INSIDE, save the complement pieces
  for axis,value,positive in [(0,bounds[0],True),(0,bounds[1],False),(2,bounds[2],True),(2,bounds[3],False)]:
   nextc=[]
   for poly in candidates:
    inside,outside=splitpoly(poly,axis,value,positive)
    if len(outside)>=3:kept.append(outside)
    if len(inside)>=3:nextc.append(inside)
   candidates=nextc
  if not candidates and len(kept)==1 and len(kept[0])==3:
   # no portion removed; keep original indexing.
   output.extend(ids);continue
  changed+=1
  if not kept:deleted+=1
  for poly in kept:
   st=len(newpos)
   for item in poly:
    newpos.append(item[0:3].tolist());newnor.append(item[3:6].tolist());newuv.append(item[6:8].tolist())
   for k in range(1,len(poly)-1):output.extend((st,st+k,st+k+1))
 return np.array(newpos,dtype='<f4'),np.array(newnor,dtype='<f4'),np.array(newuv,dtype='<f4'),np.array(output,dtype=np.uint32),{'clipped_triangles':changed,'removed_triangles':deleted,'hatch_bounds_source':bounds}

def dutch_glb(z:zipfile.ZipFile,size=2048,cut_hatch=True):
 blendname=next(i for i in z.namelist() if i.endswith('.blend'))
 source=z.read(blendname);obj=Blend(source)
 expected=['dutch_ship_medium_hull','dutch_ship_medium_rigging','dutch_ship_medium_sails']
 assert set(obj.names())==set(expected),(obj.names(),expected)
 glb=GLB();material_idx={}
 for group in ['hull','rigging','sails']:
  base,bt=texdata(z,f'dutch_ship_medium_{group}_diff_4k.png',size,alpha='dutch_ship_medium_sails_alpha_4k.png' if group=='sails' else None)
  rough=ormdata(z,group,size)
  normal,nt=texdata(z,f'dutch_ship_medium_{group}_nor_gl_4k.png',size)
  maps={name:glb.image(data,mime,group+'_'+name) for name,(data,mime) in {'base':(base,bt),'orm':(rough,'image/jpeg'),'normal':(normal,nt)}.items()}
  material_idx[group]=len(glb.doc['materials'])
  mat={'name':'Dutch_ship_'+group,'doubleSided':group=='sails','pbrMetallicRoughness':{'baseColorTexture':{'index':maps['base']},'metallicRoughnessTexture':{'index':maps['orm']},'metallicFactor':1,'roughnessFactor':1},'normalTexture':{'index':maps['normal'],'scale':0.9}}
  if group=='sails':mat['alphaMode']='MASK';mat['alphaCutoff']=0.35
  glb.doc['materials'].append(mat)
 stats={}
 for name,verts,loops,uvs,polys in obj.meshes():
  group=name.split('_')[-1]
  if group not in material_idx:raise ValueError('Unexpected Dutch mesh '+name)
  if np.any(loops['v']<0) or np.any(loops['v']>=len(verts)):raise ValueError('Invalid loop vertex index')
  v=verts['xyz'][loops['v']];pos=np.column_stack((v[:,0],v[:,2],-v[:,1])).astype('<f4')
  vn=verts['normal'][loops['v']].astype('float32')/32767.0
  norm=np.column_stack((vn[:,0],vn[:,2],-vn[:,1])).astype('<f4')
  uv=uvs['uv'].copy(); uv[:,1]=1-uv[:,1] # Blender V(bottom-left) -> glTF top-left
  tri=[]
  for poly in polys:
   lo=int(poly['start']);n=int(poly['count']);
   if n<3:continue
   for j in range(1,n-1):tri.extend((lo,lo+j,lo+j+1))
  triangles=np.array(tri,dtype=np.uint32)
  hatch_report={}
  if group=='hull' and cut_hatch:pos,norm,uv,triangles,hatch_report=cut_hatch_faces(pos,norm,uv,triangles)
  assert triangles.max()<len(pos)
  a={'POSITION':glb.accessor(pos,5126,'VEC3',pos.min(axis=0),pos.max(axis=0)), 'NORMAL':glb.accessor(norm,5126,'VEC3'), 'TEXCOORD_0':glb.accessor(uv.astype('<f4'),5126,'VEC2')}
  prim={'attributes':a,'indices':glb.accessor(triangles,5125,'SCALAR'),'mode':4,'material':material_idx[group]}
  mi=len(glb.doc['meshes']);glb.doc['meshes'].append({'name':name,'primitives':[prim]});ni=len(glb.doc['nodes']);glb.doc['nodes'].append({'name':name,'mesh':mi});glb.doc['scenes'][0]['nodes'].append(ni)
  stats[group]={'source_vertices':len(verts),'source_polygons':len(polys),'triangles':len(triangles)//3,'bounds_min':[float(x) for x in pos.min(axis=0)],'bounds_max':[float(x) for x in pos.max(axis=0)],'hatch':hatch_report}
 return glb.finish(),stats

def repack_embedded_gltf(data):
 o=json.loads(data)
 if len(o.get('buffers',[]))!=1:raise ValueError('Expected exactly one buffer in Quaternius glTF')
 uri=o['buffers'][0].pop('uri','')
 if not uri.startswith('data:') or ';base64,' not in uri:raise ValueError('glTF is not self contained')
 blob=base64.b64decode(uri.split(',',1)[1]);assert len(blob)==o['buffers'][0]['byteLength']
 if any(i.get('uri') for i in o.get('images',[])): raise ValueError('External glTF images unsupported')
 return make_glb(o,blob)

def main():
 p=argparse.ArgumentParser();p.add_argument('--dutch',required=True);p.add_argument('--kenney',required=True);p.add_argument('--quaternius',required=True);p.add_argument('--out',required=True);p.add_argument('--size',type=int,default=2048);a=p.parse_args()
 out=Path(a.out);out.mkdir(parents=True,exist_ok=True);manifest=[]
 with zipfile.ZipFile(a.dutch) as z:
  blob,stats=dutch_glb(z,a.size);fn=out/'dutch_ship_medium_pbr.glb';fn.write_bytes(blob)
  manifest.append({'file':fn.name,'source':'Poly Haven Dutch Ship Medium user-uploaded 4K Blend archive','license':'CC0','stats':stats,'size':len(blob),'sha256':hashlib.sha256(blob).hexdigest()})
  print('Dutch ship exported:',fn,len(blob)//1024//1024,'MiB',stats)
 with zipfile.ZipFile(a.kenney) as z:
  licenses=z.read('License.txt').decode('utf-8','replace');(out/'LICENSE_KENNEY.txt').write_text(licenses)
  wanted=['cannon','cannon-mobile','cannon-ball','chest','crate','barrel','barrel','flag-pirate','mast-ropes','barrel','shovel']
  for n in sorted(set(wanted)):
   name='Models/GLB format/'+n+'.glb'
   if name not in z.namelist():continue
   content=z.read(name);f=out/('kenney_'+n+'.glb');f.write_bytes(content)
   manifest.append({'file':f.name,'source':'Kenney Pirate Kit','license':'CC0','size':len(content),'sha256':hashlib.sha256(content).hexdigest()})
 with zipfile.ZipFile(a.quaternius) as z:
  wanted=['Ship_Large','Ship_Small','Prop_Cannon','Prop_CannonBall','Prop_Barrel','Prop_Bucket','Prop_Chest_Closed','Prop_Chest_Open','Prop_Anchor','Weapon_Cutlass','Characters_Captain_Barbarossa','Characters_Skeleton','Characters_Anne']
  for n in wanted:
   source=f'Pirate Kit - Nov 2023/glTF/{n}.gltf'
   if source not in z.namelist():continue
   content=repack_embedded_gltf(z.read(source));f=out/('quaternius_'+n.lower()+'.glb');f.write_bytes(content)
   manifest.append({'file':f.name,'source':'Quaternius Pirate Kit Nov 2023 (user-supplied)','license':'CC0 claimed by creator; redistribution attribution kept','size':len(content),'sha256':hashlib.sha256(content).hexdigest()})
 (out/'asset_manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False))
 print('Total generated assets',len(manifest),'size',sum(m['size'] for m in manifest)//1024//1024,'MiB')
if __name__=='__main__':main()
