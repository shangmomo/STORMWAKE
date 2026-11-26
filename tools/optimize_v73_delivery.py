import struct,json,io,hashlib,pathlib
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1]/'public/models/land/v73'
m=json.loads((root/'manifest.json').read_text())
for name in ['bear','captain','interior','house']:
 p=root/(name+'.glb'); b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);bin=b[28+n:];base=set();other=set()
 for mat in g['materials']:
  for k,info in mat.get('pbrMetallicRoughness',{}).items():
   if k.endswith('Texture'):
    (base if k=='baseColorTexture' else other).add(g['textures'][info['index']]['source'])
  for k,info in mat.items():
   if k.endswith('Texture') and isinstance(info,dict) and 'index' in info:other.add(g['textures'][info['index']]['source'])
 views={g['images'][i]['bufferView']:i for i in base-other};out=bytearray();converted=[]
 for i,v in enumerate(g['bufferViews']):
  raw=bin[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
  if i in views:
   idx=views[i];im=Image.open(io.BytesIO(raw))
   opaque=im.mode=='RGB' or (im.mode=='RGBA' and im.getextrema()[-1]==(255,255))
   if opaque and g['images'][idx]['mimeType']=='image/png':
    buf=io.BytesIO();im.convert('RGB').save(buf,format='JPEG',quality=95,subsampling=0)
    new=buf.getvalue()
    if len(new)<len(raw)*.90:converted.append(idx);raw=new;g['images'][idx]['mimeType']='image/jpeg'
  while len(out)%4:out.append(0)
  v['byteOffset']=len(out);v['byteLength']=len(raw);out.extend(raw)
 while len(out)%4:out.append(0)
 g['buffers'][0]['byteLength']=len(out);j=json.dumps(g,separators=(',',':')).encode();j+=b' '*(-len(j)%4);payload=struct.pack('<III',0x46546c67,2,28+len(j)+len(out))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(out),0x004e4942)+out;p.write_bytes(payload);m[name]['runtimeSHA256']=hashlib.sha256(payload).hexdigest();m[name]['runtimeBytes']=len(payload);m[name]['opaqueBaseColorJPEG95']=converted;print(name,len(b),len(payload),len(converted))
(root/'manifest.json').write_text(json.dumps(m,indent=2))
