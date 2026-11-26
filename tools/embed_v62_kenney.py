"""Embed the CC0 Kenney atlas accidentally omitted by the V47 import."""
from pathlib import Path
import json,struct,zipfile,hashlib,argparse
ROOT=Path(__file__).resolve().parents[1]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--kit',required=True);args=ap.parse_args()
 with zipfile.ZipFile(args.kit) as z:atlas=z.read('Models/GLB format/Textures/colormap.png');license=z.read('License.txt')
 out=ROOT/'public/models/stormwake_v62';out.mkdir(exist_ok=True);records=[]
 for source in (ROOT/'public/models/stormwake_v47').glob('kenney_*.glb'):
  raw=source.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);offset=20+n;blen,btype=struct.unpack_from('<II',raw,offset);binary=bytearray(raw[offset+8:offset+8+blen])
  for image in g.get('images',[]):
   if image.get('uri','').endswith('colormap.png'):
    while len(binary)%4:binary.append(0)
    v=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(atlas)});binary.extend(atlas);image.pop('uri');image.update({'bufferView':v,'mimeType':'image/png'})
  while len(binary)%4:binary.append(0)
  g['buffers'][0]['byteLength']=len(binary);js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
  data=struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
  (out/source.name).write_bytes(data);records.append({'file':source.name,'source':source.relative_to(ROOT).as_posix(),'sourceSHA256':hashlib.sha256(raw).hexdigest(),'sha256':hashlib.sha256(data).hexdigest(),'license':'CC0','change':'embedded original Kenney Pirate Kit 2.1 atlas; geometry unchanged'})
 (out/'LICENSE_KENNEY.txt').write_bytes(license);(out/'kenney_manifest.json').write_text(json.dumps(records,indent=2),encoding='utf-8');print('Embedded atlas in',len(records),'licensed GLBs')
if __name__=='__main__':main()
