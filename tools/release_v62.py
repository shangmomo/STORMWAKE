import argparse,json,hashlib,zipfile,difflib
from pathlib import Path
from build_fingerprint import build_fingerprint
ROOT=Path(__file__).resolve().parents[1]
def selected(p):
 r=p.relative_to(ROOT)
 return not any(x in ('node_modules','dist','.git','__pycache__') for x in r.parts) and p.suffix not in ('.pyc','.log','.zip','.webm') and not p.name.startswith('inspect-geometry')
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--baseline',required=True);ap.add_argument('--output',required=True);a=ap.parse_args();baseline=Path(a.baseline);output=Path(a.output)
 qa=ROOT/'qa/V62';qa.mkdir(parents=True,exist_ok=True);evidence=[]
 for p in sorted((ROOT/'qa').rglob('results.json')):
  raw=json.loads(p.read_text(encoding='utf-8'));evidence.append({'path':p.relative_to(ROOT).as_posix(),'errors':raw.get('errors',[]),'tests':[{'test':r.get('test') or r.get('failure'),'roundTrips':r.get('roundTrips'),'failure':r.get('failure')} for r in raw.get('results',[])]})
 for p in sorted((ROOT/'qa/V62-release').rglob('report.json')):
  raw=json.loads(p.read_text(encoding='utf-8'));evidence.append({'path':p.relative_to(ROOT).as_posix(),'tests':raw.get('tests',[]),'page_errors':raw.get('page_errors',[])})
 (qa/'evidence_index.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf-8')
 changes=[];patch=[]
 for p in sorted(ROOT.rglob('*')):
  if not p.is_file() or not selected(p):continue
  r=p.relative_to(ROOT);old=baseline/r;data=p.read_bytes()
  if old.is_file() and old.read_bytes()==data:continue
  changes.append({'path':r.as_posix(),'sha256':hashlib.sha256(data).hexdigest()})
  if r.parts[0] in ('src','server','test') and p.suffix in ('.js','.mjs'):
   before=old.read_text(encoding='utf-8-sig') if old.is_file() else '';patch.extend(difflib.unified_diff(before.splitlines(True),data.decode('utf-8-sig').splitlines(True),fromfile='V61/'+r.as_posix(),tofile='V62/'+r.as_posix()))
 (ROOT/'docs/V62_CODE_DELTA.patch').write_text(''.join(patch),encoding='utf-8')
 (ROOT/'docs/V62_BUILD_MANIFEST.json').write_text(json.dumps({'build_sha256':build_fingerprint(ROOT),'baseline':str(baseline),'changed_files':changes},ensure_ascii=False,indent=2),encoding='utf-8')
 output.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as z:
  for p in sorted(ROOT.rglob('*')):
   if p.is_file() and selected(p):z.write(p,'STORMWAKE_V62/'+p.relative_to(ROOT).as_posix())
 with zipfile.ZipFile(output) as z:
  bad=z.testzip()
  if bad:raise RuntimeError(bad)
 print(json.dumps({'output':str(output),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'changedFiles':len(changes)},ensure_ascii=False))
if __name__=='__main__':main()
