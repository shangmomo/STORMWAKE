import json,struct,zipfile,io,pathlib,hashlib
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[2]; OUT=ROOT/'public/models/expedition/v76'; DATA=pathlib.Path('/mnt/data')
def pack(j,b):
 b=bytearray(b);j['buffers']=[{'byteLength':len(b)}]; h=json.dumps(j,separators=(',',':')).encode();h+=b' '*(-len(h)%4);b+=b'\0'*(-len(b)%4);return struct.pack('<III',0x46546c67,2,28+len(h)+len(b))+struct.pack('<II',len(h),0x4e4f534a)+h+struct.pack('<II',len(b),0x004e4942)+b
def append_image(j,b,im,blob,mime):
 b.extend(b'\0'*(-len(b)%4));i=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':len(blob)});b.extend(blob);im.pop('uri',None);im.update(bufferView=i,mimeType=mime)
def make(name,stem,mask=False):
 with zipfile.ZipFile(DATA/(stem+'_2k.gltf.zip')) as z:
  j=json.loads(z.read(next(n for n in z.namelist() if n.endswith('.gltf'))));b=bytearray(z.read(j['buffers'][0]['uri']));
  for im in j['images']:
   uri=im['uri'];blob=z.read(uri);mime='image/jpeg'
   if mask and '_diff_' in uri:
    with zipfile.ZipFile(DATA/(stem+'_2k.fbx.zip')) as f:
     a=Image.open(io.BytesIO(f.read(next(n for n in f.namelist() if '_alpha_' in n)))).convert('L');rgb=Image.open(io.BytesIO(blob)).convert('RGBA');rgb.putalpha(a.resize(rgb.size));o=io.BytesIO();rgb.save(o,format='PNG');blob=o.getvalue();mime='image/png'
   append_image(j,b,im,blob,mime)
  if mask:
   for n in j['nodes']:n.pop('translation',None)
  (OUT/(name+'.glb')).write_bytes(pack(j,b))
def from_glb(data,name):
 n,_=struct.unpack_from('<II',data,12);j=json.loads(data[20:20+n]);b=bytearray(data[28+n:]); # trim unused trailing pad
 b=b[:j['buffers'][0]['byteLength']]
 # Rewrite embedded images into fresh buffer segments. Keep 2K, preserve alpha & normal maps.
 for im in j.get('images',[]):
  v=j['bufferViews'][im['bufferView']];start=v.get('byteOffset',0);img=Image.open(io.BytesIO(b[start:start+v['byteLength']])); print(name,img.size,img.mode)
 # original sources retained unchanged for accurate material appearance
 (OUT/(name+'.glb')).write_bytes(data)
make('rock02','rock_face_02');make('mountain','mountainside');make('fern','fern_02',True)
with zipfile.ZipFile(DATA/'medieval-tavern-interior-scene-rpg.zip') as z:from_glb(z.read(next(n for n in z.namelist() if n.endswith('.glb'))),'tavern')
from_glb((DATA/'blacksmith_forge.glb').read_bytes(),'forge')
for p in OUT.glob('*.glb'): print(p.name,p.stat().st_size,hashlib.sha256(p.read_bytes()).hexdigest())
