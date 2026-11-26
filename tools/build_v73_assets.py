import struct,json,io,pathlib,hashlib,shutil
from PIL import Image
import sys
root=pathlib.Path(__file__).resolve().parents[1]/'public/models/land/v73'
source=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path.cwd()
root.mkdir(parents=True,exist_ok=True)
files={'bear':'realistic_animated_bear_3d_model.glb','captain':'pirate_captain.glb','interior':'medieval_building_with_interior.glb','house':'game_ready_medieval_house_in_blender_substance.glb'}
manifest={}
for key,name in files.items():
 p=source/name; data=p.read_bytes();n=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+n]);bin=data[28+n:]; orig=hashlib.sha256(data).hexdigest()
 if key=='bear':
  for m in g['materials']:
   e=m.pop('extensions')['KHR_materials_pbrSpecularGlossiness'];m['pbrMetallicRoughness']={'baseColorFactor':e['diffuseFactor'],'baseColorTexture':e['diffuseTexture'],'metallicFactor':0,'roughnessFactor':1-e['glossinessFactor']}
  for k in ('extensionsRequired','extensionsUsed'):
   if k in g:g[k]=[x for x in g[k] if x!='KHR_materials_pbrSpecularGlossiness']
 if key in ('interior','house'):
  removed=[9,10,257,259] if key=='interior' else [860]
  for i in removed: g['nodes'][i].pop('mesh',None)
 # Repack all buffer views; preserve accessors and original geometry. House has 64 maps, cap to 1024 to avoid huge GPU footprint.
 images={im['bufferView']:im for im in g['images']}; out=bytearray(); sizes=[]
 for i,bv in enumerate(g['bufferViews']):
  raw=bin[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]
  if i in images:
   im=Image.open(io.BytesIO(raw)); old=im.size;limit=1024 if key=='house' else 2048
   if max(im.size)>limit:
    im.thumbnail((limit,limit),Image.Resampling.LANCZOS);buf=io.BytesIO();im.save(buf,format='PNG' if images[i]['mimeType']=='image/png' else 'JPEG',**({} if images[i]['mimeType']=='image/png' else {'quality':93}));raw=buf.getvalue()
   sizes.append([old,im.size]);
  while len(out)%4:out.append(0)
  bv['byteOffset']=len(out);bv['byteLength']=len(raw);out.extend(raw)
 while len(out)%4:out.append(0)
 g['buffers'][0]['byteLength']=len(out); j=json.dumps(g,separators=(',',':')).encode();j+=b' '*(-len(j)%4);payload=struct.pack('<III',0x46546c67,2,28+len(j)+len(out))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(out),0x004e4942)+out
 (root/(key+'.glb')).write_bytes(payload); manifest[key]={**g['asset']['extras'],'originalSHA256':orig,'runtimeSHA256':hashlib.sha256(payload).hexdigest(),'file':key+'.glb','sourceBytes':len(data),'runtimeBytes':len(payload),'textureSizes':sizes,'animations':[a['name'] for a in g.get('animations',[])]}; print(key,len(data),len(payload),len(sizes),flush=True)
for key,ids in [('interior',[9,10,257,259]),('house',[860])]:manifest[key]['removedMeshNodes']=ids
(root/'manifest.json').write_text(json.dumps(manifest,indent=2))
