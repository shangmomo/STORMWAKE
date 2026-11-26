"""Optional V71 licensed asset acquisition. No account, no third-party code execution.
Downloads one public GLB and installs it only after structural validation.
"""
from pathlib import Path
import argparse, hashlib, json, os, struct, sys, tempfile, urllib.request
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'public/models/land'
URL='https://media.animalanimator.com/free-3d-animated-t-rex-reference/model/tyrannosaurus-rex-rigged-animated.glb'
SOURCE='https://animalanimator.com/free-3d-animated-t-rex-reference/'
LIMIT=40*1024*1024
CLIPS={'01_Idle','02_Walk','03_Run','04_Attack'}
def validate(data):
    if len(data)<20 or len(data)>LIMIT: raise ValueError('GLB size out of range')
    magic,version,length=struct.unpack_from('<4sII',data)
    if magic!=b'glTF' or version!=2 or length!=len(data): raise ValueError('Invalid GLB header')
    n,typ=struct.unpack_from('<I4s',data,12)
    if typ!=b'JSON' or n>len(data)-20: raise ValueError('Invalid GLB JSON chunk')
    j=json.loads(data[20:20+n]); offset=20+n; binary=0
    while offset<len(data):
        if offset+8>len(data): raise ValueError('Truncated chunk')
        n,typ=struct.unpack_from('<I4s',data,offset); offset+=8
        if offset+n>len(data):raise ValueError('Truncated chunk')
        if typ==b'BIN\x00':binary+=n
        offset+=n
    if not binary or j.get('extensionsRequired'):raise ValueError('External/unsupported GLB encoding')
    if any(b.get('uri') for b in j.get('buffers',[])) or any(i.get('uri') for i in j.get('images',[])):raise ValueError('External dependencies are unsupported')
    if any(a.get('sparse') for a in j.get('accessors',[])):raise ValueError('Sparse accessors unsupported')
    skins=j.get('skins',[])
    if len(skins)!=1 or len(skins[0].get('joints',[]))<30:raise ValueError('Expected one anatomical rig with at least 30 joints')
    if not CLIPS.issubset({a.get('name') for a in j.get('animations',[])}):raise ValueError('Required original animation clips not found')
    if not any(n.get('skin')==0 and 'mesh' in n for n in j.get('nodes',[])):raise ValueError('Missing skinned mesh')
    return {'file':'trex-v71.glb','source':SOURCE,'download':URL,'license':'CC-BY-4.0','license_url':'https://creativecommons.org/licenses/by/4.0/','attribution':'Tyrannosaurus rex 3D model by AnimalAnimator.com (https://animalanimator.com), licensed under CC BY 4.0','sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'joints':len(skins[0]['joints']),'clips':sorted(CLIPS),'status':'structural validation only; runtime rig calibration still required'}
def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--local',type=Path,help='Official GLB already downloaded from the source page');args=ap.parse_args()
    try:
        if args.local:
            if args.local.stat().st_size>LIMIT:raise ValueError('Asset exceeds size limit')
            data=args.local.read_bytes()
        else:
            req=urllib.request.Request(URL,headers={'User-Agent':'STORMWAKE/71 optional licensed asset importer'})
            with urllib.request.urlopen(req,timeout=45) as response:
                data=response.read(LIMIT+1)
        record=validate(data);DEST.mkdir(parents=True,exist_ok=True)
        for filename,content in [(record['file'],data),('trex-v71.json',json.dumps(record,indent=2).encode('utf-8'))]:
            with tempfile.NamedTemporaryFile(dir=DEST,delete=False) as f:f.write(content);tmp=Path(f.name)
            os.replace(tmp,DEST/filename)
        print('T. rex GLB structurally validated:',record['bytes'],'bytes;',record['joints'],'joints. Restart V71. The runtime may still reject an incompatible skeleton.')
        print(record['attribution'])
        return 0
    except Exception as exc:
        print('Optional asset was not installed:',exc,file=sys.stderr);print('V71 base game remains playable. Official page:',SOURCE,file=sys.stderr);return 1
if __name__=='__main__':raise SystemExit(main())
