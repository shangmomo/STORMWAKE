#!/usr/bin/env python3
"""Opt-in guarded AutoQA -> Codex -> regression loop for the local PC.

This is deliberately finite, never a silent background service. Requires an
installed and authenticated Codex CLI. It only proposes source-code edits; if
checks become worse it restores the source snapshot. It cannot guarantee art.
"""
from __future__ import annotations
import argparse, hashlib, json, os, shutil, subprocess, sys, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
RUNNER=ROOT/'tools'/'autoqa'/'runner.py'
PROTECTED=[ROOT/'tools'/'autoqa'/'runner.py',ROOT/'tools'/'autoqa'/'repair_loop.py',
           ROOT/'src'/'qa'/'Assertions.js',ROOT/'src'/'qa'/'AutoQA.js', ROOT/'test'/'stormwake-v58-autoqa.mjs', ROOT/'package.json']

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None

def snapshot(src,out):
    if out.exists():shutil.rmtree(out)
    shutil.copytree(src,out)

def restore(src,out):
    if src.exists():shutil.rmtree(src)
    shutil.copytree(out,src)

def run(cmd,log,timeout=900):
    with open(log,'w',encoding='utf-8') as fh:
        try:return subprocess.run(cmd,cwd=ROOT,stdout=fh,stderr=subprocess.STDOUT,timeout=timeout).returncode
        except subprocess.TimeoutExpired:fh.write('\nAutoQA: command timeout\n');return 124

def latest_report(folder):
    rs=list(folder.glob('V58_*/report.json'))
    if not rs:return None
    return max(rs,key=lambda p:p.stat().st_mtime)

def score(report):
    if not report:return 999
    r=json.loads(report.read_text(encoding='utf-8'))
    if not r.get('simulation_verified'):
        return None  # Don't ask a coding model to fix an unverified GPU/browser environment.
    return sum(t['status']=='fail' for t in r['tests'])

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--cycles',type=int,default=2)
    ap.add_argument('--autofix',action='store_true',help='显式允许 Codex 修改 src 目录')
    ap.add_argument('--quick',action='store_true',help='开发调试：不运行双人浏览器')
    ap.add_argument('--headless',action='store_true')
    opts=ap.parse_args()
    if opts.cycles<1 or opts.cycles>4:ap.error('1 <= --cycles <= 4')
    if not opts.autofix:
        print('未指定 --autofix，只允许执行只读 QA。用 00_RUN_AUTOQA_V58.cmd。');return 2
    if not shutil.which('codex'):
        print('未发现 Codex CLI。请先安装并登录 Codex，再运行自动修复。');return 2
    base=ROOT/'autoqa_reports'/('repair_'+time.strftime('%Y%m%d_%H%M%S'))
    base.mkdir(parents=True,exist_ok=True)
    def verify(cycle):
        prefix=base/str(cycle)
        prefix.mkdir(exist_ok=True)
        npm=shutil.which('npm') or shutil.which('npm.cmd')
        if not npm:
            print('回归测试要求 Node.js/npm 环境');return None,None
        p=run([npm,'run','test:v58'],prefix/'logic.log',240)
        if p:
            print('完整逻辑回归失败，停止自动编辑，先检查 logic.log');return None,None
        cmd=[sys.executable,str(RUNNER),'--report-dir',str(prefix/'webgpu')]
        cmd+=['--quick'] if opts.quick else []
        cmd+=['--headless'] if opts.headless else (['--headed'] if os.name=='nt' else [])
        rc=run(cmd,prefix/'runner.log',900)
        report=latest_report(prefix/'webgpu')
        sc=score(report)
        if sc is None:
            print('浏览器/WebGPU 未能完成真实初始化。停止修复，避免代理胡乱修改有效代码。')
            return None,report
        return sc,report
    prior,report=verify(0)
    if prior is None:return 3
    if prior==0:
        print('已有的可验证测试全部通过；仍需人工审阅 3D 截图与游戏品质。');return 0
    for cycle in range(1,opts.cycles+1):
        print(f'== AutoQA guarded fix cycle {cycle}/{opts.cycles}; baseline failures {prior} ==',flush=True)
        d=base/str(cycle);d.mkdir(exist_ok=True)
        source_backup=d/'src_before';snapshot(ROOT/'src',source_backup)
        checks={str(p):sha(p) for p in PROTECTED}
        all_tests={str(p):sha(p) for p in (ROOT/'test').rglob('*.mjs')}
        fail_entries=json.loads(report.read_text(encoding='utf-8')).get('tests',[]) if report else []
        failures=[t for t in fail_entries if t.get('status')=='fail'][:15]
        prompt=('你正在维护 STORMWAKE V58 WebGPU 海盗游戏。只修改 src/ 中实现，不要修改测试、'
                'QA 诊断代码、测试脚本、启动器、报告和任何模型贴图素材。只修复以下实机重现失败项，不要伪造通过或'
                '关掉错误检查。修复完运行 node test/stormwake-v58-autoqa.mjs。'
                '如果失败是 GPU/浏览器环境问题，不要尝试通过代码掩盖。\n'+json.dumps(failures,ensure_ascii=False,indent=2))
        cmd=['codex','exec','--sandbox','workspace-write','-C',str(ROOT),prompt]
        codex_code=run(cmd,d/'codex.log',1500)
        if codex_code or any(sha(p)!=checks[str(p)] for p in PROTECTED) or any(sha(Path(p))!=h for p,h in all_tests.items()):
            restore(ROOT/'src',source_backup)
            print('Codex 失败或试图修改受保护 QA/测试：已恢复 src 原文件。');return 4
        after,report_after=verify(cycle)
        if after is None or after>=prior:
            restore(ROOT/'src',source_backup)
            print(f'回归没有改善（旧 {prior}, 新 {after}），已恢复 src 原文件；停止。')
            return 5
        prior,report=after,report_after
        print(f'保留经验证的修复：失败减少到 {prior}')
        if prior==0:break
    print('最终失败项：',prior,'；所有结果保存在',base)
    return 0 if prior==0 else 1

if __name__=='__main__':sys.exit(main())
