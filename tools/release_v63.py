"""Package a reviewable V63 development build, with evidence and source hashes."""
import argparse,hashlib,json,os,zipfile,difflib
from pathlib import Path
from build_fingerprint import build_fingerprint
ROOT=Path(__file__).resolve().parents[1]
def files():
 for directory,folders,names in os.walk(ROOT):
  folders[:]=sorted(x for x in folders if x not in {'node_modules','dist','.git','__pycache__'})
  for name in sorted(names):
   p=Path(directory)/name;r=p.relative_to(ROOT)
   if p.suffix.lower() in {'.pyc','.zip','.webm'} or name.startswith('inspect-geometry'):continue
   if p.suffix=='.log' and not (r.parts[0]=='qa' and name.startswith('V63-') and name.endswith('-latest.log')):continue
   if r.parts[0]=='qa' and (not r.parts[1].startswith('V63') or name=='cpu_tilt_debug.json'):continue
   yield p
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--baseline',required=True);ap.add_argument('--output',required=True);args=ap.parse_args();baseline=Path(args.baseline).resolve();output=Path(args.output).resolve()
 if not (baseline/'src').is_dir():raise ValueError('Baseline must contain the actual source tree')
 changes=[];patch=[]
 for p in files():
  r=p.relative_to(ROOT)
  if r.parts[0] in {'qa','autoqa_reports'} or r.name.startswith('V63_CODE_DELTA') or r.name.startswith('V63_BUILD_MANIFEST'):continue
  old=baseline/r;digest=sha(p)
  if old.is_file() and sha(old)==digest:continue
  changes.append({'path':r.as_posix(),'sha256':digest,'bytes':p.stat().st_size})
  if r.parts[0] in {'src','server','test'} and p.suffix in {'.js','.mjs'}:
   before=old.read_text(encoding='utf-8-sig') if old.is_file() else ''
   patch.extend(difflib.unified_diff(before.splitlines(True),p.read_text(encoding='utf-8-sig').splitlines(True),fromfile='V62/'+r.as_posix(),tofile='V63/'+r.as_posix()))
 (ROOT/'docs/V63_CODE_DELTA.patch').write_text(''.join(patch),encoding='utf-8')
 evidence=[p.relative_to(ROOT).as_posix() for p in files() if p.relative_to(ROOT).parts[0]=='qa' and p.name in {'report.json','results.json'}]
 manifest={'version':'V63 development acceptance build','build_sha256':build_fingerprint(ROOT),'baseline':str(baseline),'changed_files':changes,'evidence':evidence,'verification_limits':'See docs/V63_IMPLEMENTATION_TRACKER.md; historical failed trials are retained. This is not a claim that the entire GDD or zero-defect acceptance is complete.'}
 (ROOT/'docs/V63_BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 output.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as archive:
  for p in files():archive.write(p,'STORMWAKE_V63/'+p.relative_to(ROOT).as_posix())
 with zipfile.ZipFile(output) as archive:
  bad=archive.testzip()
  if bad:raise RuntimeError('Archive CRC failed: '+bad)
 print(json.dumps({'output':str(output),'bytes':output.stat().st_size,'sha256':sha(output),'changedFiles':len(changes)},ensure_ascii=True))
if __name__=='__main__':main()
