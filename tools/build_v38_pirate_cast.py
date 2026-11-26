"""Build color-separated, fully rigged pirate villagers from previously sourced
Quaternius CC0 models. Does NOT claim to contain the separate Pirate Kit pack.
Original meshes, joint weights and animation buffers remain unchanged.
Run: python tools/build_v38_pirate_cast.py
"""
from __future__ import annotations
import json, struct, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'public/models/land'
SOURCES = {
    'sailor': ROOT/'tools/assets_stage/man.glb',
    'rogue': ROOT/'tools/assets_stage/character_animated.glb'
}
PALETTES = [
  ('admiral', 0x253e59, 0xa87f46, 0x45352e, 0xc6a779),
  ('sailor', 0x4c6f6e, 0xb49363, 0x514b3d, 0xaf8570),
  ('corsair', 0x61363c, 0xbd9054, 0x333c44, 0xcba68b),
  ('herbalist', 0x49624a, 0x9da773, 0x4f4439, 0xc7ae85),
  ('explorer', 0x746144, 0xcab076, 0x40515c, 0xb58f69),
  ('nightwatch', 0x2f404e, 0x9b6b50, 0x333840, 0x997757),
  ('shipwright', 0x79604d, 0xd2ab74, 0x393b38, 0xb68c69),
  ('innkeeper', 0x6f4854, 0xd4ac84, 0x544943, 0xc5a489),
  ('messenger', 0x336165, 0xaca87c, 0x414c3d, 0xc3a074),
  ('scholar', 0x4f5277, 0xd0ba7e, 0x3b3439, 0xc0a080),
]

def c(hexcode):
    # glTF factors are linear. Keep midtones restrained under midday light.
    return [round(((hexcode>>i)&255)/255,6) for i in (16,8,0)] + [1.]

def build(src:Path,out:Path,palette,extra=None):
    raw=src.read_bytes(); assert raw[:4]==b'glTF'
    magic,ver,length=struct.unpack_from('<4sII',raw,0)
    jslen,jstype=struct.unpack_from('<I4s',raw,12); assert jstype==b'JSON'
    j=json.loads(raw[20:20+jslen]); materials=j.get('materials',[])
    shirt,trim,pants,skin=palette
    for m in materials:
      name=m.get('name','').lower()
      if 'shirt' in name or 'cloth' in name or 'coat' in name or 'jacket' in name:
        color=shirt
      elif 'pant' in name or 'boot' in name or 'sock' in name:
        color=pants
      elif 'skin' in name or name in ('face','hands'):
        color=skin
      elif 'detail' in name or 'belt' in name or 'leather' in name:
        color=trim
      else:continue
      m.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=c(color)
    j.setdefault('asset',{})['generator']='Tidewater V38 CC0 color variant (Quaternius original rig and animations)'
    js=json.dumps(j,ensure_ascii=True,separators=(',',':')).encode('utf-8')
    js+=b' ' * ((4-len(js)%4)%4)
    rest=raw[20+jslen:]; total=12+8+len(js)+len(rest)
    data=struct.pack('<4sII',b'glTF',2,total)+struct.pack('<I4s',len(js),b'JSON')+js+rest
    assert len(data)==total
    out.write_bytes(data)
    return {'file':out.name,'source':src.name,'sha256':hashlib.sha256(data).hexdigest(),'joints':len(j['skins'][0]['joints']),'animations':len(j['animations']),'materials':len(materials)}

records=[]
for i,(name,*colors) in enumerate(PALETTES):
  kind='rogue' if i%2==0 else 'sailor'
  records.append({'id':name,'family':kind,**build(SOURCES[kind],OUT/f'pirate_{name}.glb',colors)})
# Hero and boss both genuinely use skeletal human rigs and sword action clips.
records.append({'id':'captain','family':'rogue',**build(SOURCES['rogue'],OUT/'pirate_captain.glb',(0x253b53,0xd7b27b,0x2d3948,0xc2a07e))})
records.append({'id':'corsair_boss','family':'rogue',**build(SOURCES['rogue'],OUT/'pirate_corsair_boss.glb',(0x3b252c,0xc7a35c,0x1f3037,0xa88271))})
(OUT/'v38_pirate_cast_sources.json').write_text(json.dumps({
 'source_attribution':{
 'sailor':'Quaternius Animated Man (CC0, https://poly.pizza/m/HMnuH5geEG); source tools/assets_stage/man.glb',
 'rogue':'Quaternius RPG Characters Pack (CC0, https://quaternius.com/packs/rpgcharacters.html); source tools/assets_stage/character_animated.glb'},
 'notes':'Rig, mesh, weights, clip channels and buffer bytes preserved; only glTF material palette changed.',
 'models':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('V38 piratified:',len(records),'GLBs',sum(len((OUT/r['file']).read_bytes()) for r in records),'bytes')
