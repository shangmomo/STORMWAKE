"""Pack only reviewed, licensed user-supplied models. No network or placeholders."""
import json,struct,io,hashlib,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]; src=Path(sys.argv[1] if len(sys.argv)>1 else '/mnt/data'); out=ROOT/'public/models/expedition/v74';out.mkdir(parents=True,exist_ok=True)
SPECS={
'ptero':('male_pteranodon_-_natural_locomotion_rig.glb','Animal Animator','https://sketchfab.com/3d-models/male-pteranodon-natural-locomotion-rig-cfc9ae11a807447dbcaece3753ded59f',2048),
'wolf':('wolf_-_realistic_3d_model_demo_free.glb','WildMesh 3D','https://sketchfab.com/3d-models/wolf-realistic-3d-model-demo-free-8840b859a566485c874a27b1731e1db8',2048),
'ray':('stonewisp_-_mutant_stingray_-rigged_and_animated.glb','HighPolyDensity','https://sketchfab.com/3d-models/stonewisp-mutant-stingray-rigged-and-animated-ca27ab932b21407ba30376340f4c4444',1024),
'grotto':('grotto_cavern_cave.glb','pixol3d','https://sketchfab.com/3d-models/grotto-cavern-cave-aa059550ba7543b9b5eb37d7fc19363d',2048),
}
manifest={}
for key,(fn,author,url,limit) in SPECS.items():
 raw=(src/fn).read_bytes(); jl=struct.unpack_from('<I',raw,12)[0];d=json.loads(raw[20:20+jl]);data=memoryview(raw)[28+jl:];new=bytearray();images={im['bufferView']:i for i,im in enumerate(d['images'])};colors=set();alpha=set()
 for m in d['materials']:
  ext=m.get('extensions',{}).pop('KHR_materials_pbrSpecularGlossiness',None)
  if ext:
   m['pbrMetallicRoughness']={'baseColorFactor':ext.get('diffuseFactor',[1,1,1,1]),'baseColorTexture':ext['diffuseTexture'],'metallicFactor':0,'roughnessFactor':1-ext.get('glossinessFactor',0)}
  m.get('extensions',{}).pop('KHR_materials_specular',None)
  if not m.get('extensions'):m.pop('extensions',None)
  tex=m.get('pbrMetallicRoughness',{}).get('baseColorTexture');
  if tex:
   idx=d['textures'][tex['index']]['source'];colors.add(idx)
   if m.get('alphaMode') in ('BLEND','MASK'):alpha.add(idx)
  if m.get('emissiveTexture'):colors.add(d['textures'][m['emissiveTexture']['index']]['source'])
 for e in ['extensionsUsed','extensionsRequired']:
  if e in d:d[e]=[v for v in d[e] if v not in ['KHR_materials_pbrSpecularGlossiness','KHR_materials_specular']];
  if not d.get(e):d.pop(e,None)
 sizes=[]
 for i,v in enumerate(d['bufferViews']):
  b=bytes(data[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
  if i in images:
   j=images[i];im=Image.open(io.BytesIO(b));before=im.size
   if max(im.size)>limit or (j in colors and j not in alpha):
    im.thumbnail((limit,limit),Image.Resampling.LANCZOS);f=io.BytesIO();
    if j in colors and j not in alpha: im.convert('RGB').save(f,'JPEG',quality=95,subsampling=0);d['images'][j]['mimeType']='image/jpeg'
    else: im.save(f,'PNG',compress_level=5);d['images'][j]['mimeType']='image/png'
    b=f.getvalue()
   sizes.append([before,im.size])
  new.extend(b'\0'*((-len(new))%4));v['byteOffset']=len(new);v['byteLength']=len(b);new.extend(b)
 new.extend(b'\0'*((-len(new))%4));d['buffers'][0]['byteLength']=len(new);js=json.dumps(d,separators=(',',':')).encode();js+=b' '*((-len(js))%4);result=struct.pack('<III',0x46546c67,2,28+len(js)+len(new))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(new),0x004e4942)+new;(out/(key+'.glb')).write_bytes(result)
 manifest[key]={'file':key+'.glb','original':fn,'author':author,'source':url,'license':'CC Attribution (source page)','licenseURL':'https://creativecommons.org/licenses/by/4.0/','originalSHA256':hashlib.sha256(raw).hexdigest(),'runtimeSHA256':hashlib.sha256(result).hexdigest(),'textureSizes':sizes,'triangles':sum(d['accessors'][p['indices']]['count']//3 for m in d['meshes'] for p in m['primitives']),'clips':[a['name'] for a in d.get('animations',[])],'changes':'Texture resize / opaque color JPEG95; wolf legacy diffuse PBR conversion; pteranodon optional specular extension removed. Geometry and animation unchanged.'};print(key,len(raw),len(result))
(out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
