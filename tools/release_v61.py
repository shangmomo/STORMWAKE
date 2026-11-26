"""Create traceable acceptance indexes, asset checksums, delta and full source ZIP."""
import argparse
import csv
import difflib
import hashlib
import json
from pathlib import Path
import zipfile
from build_fingerprint import build_fingerprint
ROOT=Path(__file__).resolve().parents[1]

CASES='''开屏关闭|鼠标锁定|地图开关|UI焦点恢复|1080p字幕与中心视野|船头封闭|船尾封闭|栏杆阻挡|跳上船沿|双人甲板交错|室外开门进入|室内开门退出|门口对向错身|门夹人停止|风暴倾斜通行|下货舱|上货舱|连续20轮上下舱|抱货入舱|下舱中途取消|干舱静水|干舱大浪|窗外可见海|玩家进入水面|破口后真积水|修补后水不自动消失|E进入锚机|W起锚|S放锚|两人协作起锚|四人协作起锚|释放立即停止|锚链高度同步|起锚满帆离港|满收帆停车|顺逆风差异|舵轮居中|风暴侧滑|返港系泊|取炮弹|实体装填|炮架瞄准同步|实际炮弹轨迹|命中船壳破洞|修补破口|桶舀水倒水|火灾同步|两人跑跳|四人在船|同物品争抢|房主切换|后加入|失联恢复|风暴时间一致|未接触不伤害|触手接触抓船|陆地Boss全身可见|远海穿越风暴|龙卷推力|日夜风暴FPS和VRAM'''.split('|')

def sha(data):return hashlib.sha256(data).hexdigest()
def selected(path):
    rel=path.relative_to(ROOT)
    if any(p in ('node_modules','dist','.git','__pycache__','autoqa_reports') for p in rel.parts):return False
    if path.suffix in ('.pyc','.tmp'):return False
    # Retain all trial outcomes, but only final acceptance media in the ZIP.
    if rel.parts[:2]==('qa','V61') and path.suffix in ('.webm','.zip'):
        return any(part.startswith('release-validation') for part in rel.parts)
    return True

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--source-zip',required=True);ap.add_argument('--output',required=True);args=ap.parse_args()
    qa=ROOT/'qa/V61';qa.mkdir(parents=True,exist_ok=True)
    reports=[]
    for p in sorted(qa.rglob('report.json')):
        report=json.loads(p.read_text(encoding='utf-8'))
        reports.append({'path':p.relative_to(ROOT).as_posix(),'version':report.get('version'),'build_sha256':report.get('build_sha256'),
            'started_at':report.get('started_at'),'counts':report.get('counts'),
            'results':{t['test']:{'status':t['status'],'detail':t.get('detail','')} for t in report['tests']}})
    reports.sort(key=lambda r:r.get('started_at',''))
    (qa/'evidence_index.json').write_text(json.dumps({'current_build_sha256':build_fingerprint(ROOT),'reports':reports},ensure_ascii=False,indent=2),encoding='utf-8')
    def evidence(test,passed=True):
        hits=[r for r in reports if test in r['results'] and (not passed or r['results'][test]['status']=='pass')]
        return hits[-1] if hits else None
    mapping={1:'start_overlay_dismissed',11:'route_cabin_repeated',16:'route_cargo_repeated',17:'route_cargo_repeated',18:'route_cargo_repeated',20:'ladder_cancel_returns',27:'interact_anchor',28:'anchor_winding',31:'cooperative_capstan',32:'capstan_release_stops',49:'real_4_clients',51:'host_handoff'}
    rows=[]
    for i,label in enumerate(CASES,1):
        status='not_run';proof='';note='未完成此用例的完整实机验收；逻辑回归不替代实机。'
        if i in mapping:
            r=evidence(mapping[i])
            if r:status='verified';proof=r['path']+'#'+mapping[i];note=r['results'][mapping[i]]['detail']
        if i in (5,6,7,21,22,23,57,58):
            r=evidence('logic_captain_lower_hold' if i in (21,22,23) else 'logic_captain_boss' if i==57 else 'logic_captain_open_sea' if i==58 else 'logic_captain_helm')
            if r:status='visual_review_required';proof=r['path'];note='代表帧已采集；指定分辨率、角度或完整工况仍需人工逐项验收。'
        # A failed four-page attempt is visible even when its short two-page
        # checks succeeded. Successful later runs explicitly supersede it.
        if i in (31,49,51) and status=='not_run' and evidence('two_client_sequence',False):
            r=evidence('two_client_sequence',False);status='failed';proof=r['path'];note=r['results']['two_client_sequence']['detail']
        rows.append({'case_id':f'QA-{i:03}','requirement':label,'status':status,'evidence':proof,'scope_or_remaining_work':note})
    with (qa/'acceptance_cases.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    original=Path(args.source_zip)
    changes=[];patch=[]
    with zipfile.ZipFile(original) as source:
        originals={n.split('/',1)[1]:n for n in source.namelist() if '/' in n and not n.endswith('/')}
        collections=[list((ROOT/folder).rglob('*')) for folder in ('src','server','test','tools')]
        collections.append([p for p in ROOT.iterdir() if p.suffix in ('.py','.cmd','.json')])
        for files in collections:
            for p in sorted(files):
                if not p.is_file() or not selected(p):continue
                rel=p.relative_to(ROOT).as_posix();new=p.read_bytes();old=source.read(originals[rel]) if rel in originals else b''
                if new==old:continue
                changes.append({'path':rel,'kind':'modified' if rel in originals else 'added','sha256':sha(new)})
                if p.suffix in ('.js','.mjs','.py','.cmd','.json','.css'):
                    patch.extend(difflib.unified_diff(old.decode('utf-8-sig').splitlines(True),new.decode('utf-8-sig').splitlines(True),fromfile='V60/'+rel,tofile='V61/'+rel))
        assets=[]
        for rel,license_name,credits in [('public/models/stormwake_v54/dutch_ship_lower_hold.glb','CC0','public/models/stormwake_v54/hatch_manifest.json'),('public/models/stormwake_v50/captains_quarters_access.glb','CC BY 4.0 TheMadraver','public/models/stormwake_v50/CREDITS_V50.md'),('public/models/stormwake_v50/captain_sea_chart.glb','Project original','public/models/stormwake_v50/CREDITS_V50.md')]:
            data=(ROOT/rel).read_bytes();assets.append({'path':rel,'sha256':sha(data),'unchanged_from_v60':data==source.read(originals[rel]),'license_as_documented':license_name,'credits':credits})
    (ROOT/'docs/V61_CODE_DELTA.patch').write_text(''.join(patch),encoding='utf-8')
    (ROOT/'docs/V61_ASSET_MANIFEST.json').write_text(json.dumps({'primary_assets':assets,'new_models_or_audio':[],'procedural_additions':['InteriorLanterns.js'],'license_note':'Existing source credits retained; no external licensing re-audit claimed.'},ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'docs/V61_BUILD_MANIFEST.json').write_text(json.dumps({'build_sha256':build_fingerprint(ROOT),'source_zip_sha256':sha(original.read_bytes()),'changed_code':changes,'acceptance_csv':'qa/V61/acceptance_cases.csv','evidence_index':'qa/V61/evidence_index.json'},ensure_ascii=False,indent=2),encoding='utf-8')
    output=Path(args.output).resolve();output.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        for p in sorted(ROOT.rglob('*')):
            if p.is_file() and selected(p) and p.resolve()!=output:archive.write(p,'STORMWAKE_V61/'+p.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(output) as archive:
        bad=archive.testzip()
        if bad:raise RuntimeError('Archive CRC failed: '+bad)
    print(json.dumps({'output':str(output),'bytes':output.stat().st_size,'sha256':sha(output.read_bytes()),'changed_code_files':len(changes),'cases':len(rows)},ensure_ascii=False))

if __name__=='__main__':main()
