#!/usr/bin/env python3
"""Restore the CC0 Dutch hull directly from user's original Blender archive.
This V49 export NEVER cuts arbitrary cabin/hatch holes or introduces meshes.
"""
import importlib.util, hashlib, json, zipfile, sys
from pathlib import Path
root=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('dutch_converter',root/'tools/v47/import_uploaded_assets.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
source=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/mnt/data/files/dutch_ship_medium_4k.blend.zip')
target=root/'public/models/stormwake_v47/dutch_ship_medium_pbr.glb'
with zipfile.ZipFile(source) as archive: content, stats=mod.dutch_glb(archive,size=2048,cut_hatch=False)
target.write_bytes(content)
manifest=root/'public/models/stormwake_v47/asset_manifest.json'
m=json.loads(manifest.read_text())
print('manifest format',type(m),list(m)[:3] if isinstance(m,dict) else 'list')
if isinstance(m,list): entries=m
else: entries=m.get('assets',[])
for entry in entries:
 if entry.get('file')==target.name:
  entry['sha256']=hashlib.sha256(content).hexdigest()
  entry['size']=len(content)
  entry['stats']=stats
  entry['reexport']='V49: no V47 artificial hatch cut; source is the original user-provided Blender mesh'
manifest.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print('Uncut original Dutch GLB',len(content),'bytes; sha256',hashlib.sha256(content).hexdigest(),'stats',stats)
