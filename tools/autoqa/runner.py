#!/usr/bin/env python3
"""STORMWAKE V62 AutoQA — real WebGPU browser acceptance tests.

Use Python 3.10+, Playwright, Pillow, Chrome/Edge and a GPU with WebGPU.
Runs isolated local game+room servers, two actual browsers/contexts in FULL mode,
archives console/network errors, snapshots, screenshots, video and trace files.
This script NEVER edits the game or labels unobserved visual quality as passing.
"""
from __future__ import annotations
import argparse
import json
from html import escape
import os
from pathlib import Path
import platform
import shutil
import socket
import statistics
import subprocess
import sys
import time
from datetime import datetime
from urllib.request import urlopen
from urllib.error import URLError
from urllib.parse import urlencode

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
from build_fingerprint import build_fingerprint
DEFAULT_REPORTS=ROOT/'autoqa_reports'

def check_port(port):
    try:
        with socket.create_connection(('127.0.0.1',port),timeout=.6):return True
    except OSError:return False

def wait_url(url,seconds=20):
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
        try:
            with urlopen(url,timeout=.5) as r:
                if r.status==200:return True
        except (OSError, URLError):pass
        time.sleep(.2)
    return False

def image_metrics(path):
    try:
        from PIL import Image,ImageStat
        with Image.open(path) as im:
            im=im.convert('RGB'); im.thumbnail((360,200)); px=list(im.getdata());
            l=[.2126*r+.7152*g+.0722*b for r,g,b in px]
            if not px:return {}
            near_black=sum(1 for n in l if n<7)/len(l)
            near_white=sum(1 for n in l if n>246)/len(l)
            cyan=sum(1 for r,g,b in px if g>155 and b>160 and b>r*1.5)/len(l)
            return {'width':im.width,'height':im.height,'luminanceStd':round(statistics.pstdev(l),2),
                    'blackRatio':round(near_black,4),'whiteRatio':round(near_white,4),'cyanRatio':round(cyan,4)}
    except Exception as e:return {'analysis_error':str(e)}

def verdict_visual(m,scenario):
    if 'analysis_error' in m:return {'status':'unverified','reason':m['analysis_error']}
    if m.get('luminanceStd',0)<3 or m.get('blackRatio',0)>.94 or m.get('whiteRatio',0)>.92:
        return {'status':'suspect','reason':'近乎纯黑、纯白或单色画面'}
    if scenario in ('cabin','lower_hold') and m.get('cyanRatio',0)>.24:
        return {'status':'suspect','reason':'船舱截图出现大面积蓝青色像素；疑似穿透海水（需人工复核）'}
    return {'status':'captured','reason':'画面已获取，仍需视觉审阅；不能仅凭像素统计判断精美或无穿模'}

def main(argv=None):
    if hasattr(sys.stdout,'reconfigure'):sys.stdout.reconfigure(encoding='utf-8')
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--quick',action='store_true',help='只运行单人场景抽样（更快）')
    ap.add_argument('--all-scenes',action='store_true',help='单人模式也拍摄全部关键场景')
    ap.add_argument('--route-cycles',type=int,default=0,help='用真实 E 按键连续往返货舱和船长室的次数')
    ap.add_argument('--clients',type=int,choices=[2,3,4],default=2,help='完整联机验收的实际 WebGPU 客户端数')
    ap.add_argument('--render-scale',type=float,default=1.0,help='实际内部渲染比例 0.5..1（保留输出分辨率）')
    ap.add_argument('--max-fps',type=int,default=60,help='验收页面帧率上限 15..240，避免多客户端挤占着色器编译时间')
    ap.add_argument('--existing',action='store_true',help='连接已有本地游戏网页和服务器')
    ap.add_argument('--port',type=int,default=5173)
    ap.add_argument('--browser',choices=['auto','chrome','msedge','chromium'],default='auto')
    ap.add_argument('--headed',action='store_true',help='显示真实浏览器窗口（适合 Windows 显卡）')
    ap.add_argument('--headless',action='store_true',help='无头运行；WebGPU 取决于浏览器和显卡支持')
    ap.add_argument('--timeout',type=int,default=180,help='最大游戏初始化等待秒数')
    ap.add_argument('--report-dir',default=str(DEFAULT_REPORTS))
    args=ap.parse_args(argv)
    if args.port<1024 or args.port>65535:ap.error('port must be 1024..65535')
    if not .5<=args.render_scale<=1:ap.error('render-scale must be .5..1')
    if not 15<=args.max_fps<=240:ap.error('max-fps must be 15..240')
    base=Path(args.report_dir).resolve()
    out=base / datetime.now().strftime('V62_%Y%m%d_%H%M%S')
    out.mkdir(parents=True,exist_ok=True)
    (out/'screenshots').mkdir(exist_ok=True)
    (out/'video').mkdir(exist_ok=True)
    report={'version':'STORMWAKE V62','started_at':datetime.now().isoformat(),
        'build_sha256':build_fingerprint(ROOT),'seed':61015,
        'environment':{'platform':platform.platform(),'python':sys.version.split()[0],
            'browser':args.browser,'headless':bool(args.headless)},
        'browser_verified':False,'simulation_verified':False,'tests':[],
        'console_errors':[], 'page_errors':[], 'network_errors':[],
        'limitations':['截图异常检测只筛选可疑画面，不代表达到商业 3A 美术品质',
                       '动态 WebGPU 画面及船体隔水需要在真实 GPU 驱动上执行']}
    def result(name,status,detail='',data=None):
        entry={'test':name,'status':status,'detail':detail}
        if data is not None:entry['data']=data
        report['tests'].append(entry)
        print(f'[{status.upper():9}] {name} {detail}',flush=True)
        return entry
    def save_report():
        report['finished_at']=datetime.now().isoformat()
        report['counts']={k:sum(x['status']==k for x in report['tests']) for k in ['pass','fail','suspect','captured','unverified']}
        (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        md=['# STORMWAKE V62 AutoQA 实机检测报告','',f"环境：{report['environment']['platform']}",'',
            f"浏览器运行验证：{report['browser_verified']}；游戏初始化验证：{report['simulation_verified']}",'',
            '| 项目 | 状态 | 结论 |','|---|---|---|']
        for t in report['tests']:
            md.append('| '+ ' | '.join([t['test'],t['status'],str(t['detail']).replace('|','/').replace('\n',' ')[:200]])+' |')
        md+=['','## 不能自动证明的内容']+['- '+x for x in report['limitations']]
        (out/'REPORT_zh.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
        badges=[]
        for t in report['tests']:
            color={'pass':'ok','fail':'bad','suspect':'warn','unverified':'unset'}.get(t['status'],'unset')
            badges.append('<tr><td>'+escape(t['test'])+'</td><td><span class="pill '+color+'">'+escape(t['status'])+'</span></td><td>'+escape(str(t['detail']))+'</td></tr>')
        screenshots=[]
        for f in sorted((out/'screenshots').glob('*.png')):
            screenshots.append('<figure><a href="screenshots/'+escape(f.name)+'"><img loading="lazy" src="screenshots/'+escape(f.name)+'"></a><figcaption>'+escape(f.stem)+'</figcaption></figure>')
        html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>STORMWAKE V62 · AutoQA</title><style>
body{margin:0;background:#0c1823;color:#e9e6dc;font:15px/1.65 system-ui,'Microsoft YaHei',sans-serif}main{max-width:1260px;margin:auto;padding:34px}h1{letter-spacing:.09em;color:#e8c996;font-size:28px}h2{font-size:20px;margin-top:40px;border-bottom:1px solid #3c5260;padding-bottom:8px}p{color:#a9bfca}.stat{display:flex;gap:10px;flex-wrap:wrap}.stat b{display:block;font-size:22px;color:#fff}.stat span{padding:8px 19px;border:1px solid #3a5360;border-radius:9px}table{border-collapse:collapse;width:100%;background:#142635}th,td{padding:8px 12px;border-bottom:1px solid #2d414b;text-align:left}td:first-child{font-family:Consolas,monospace}.pill{border-radius:5px;padding:2px 8px}.ok{background:#184a3c;color:#a1e9bf}.bad{background:#602b34;color:#ffd2d2}.warn{background:#604b25;color:#ffe0ac}.unset{background:#344455;color:#c6d2df}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px}figure{margin:0;background:#142635;border:1px solid #334551;border-radius:8px;overflow:hidden}img{width:100%;display:block}figcaption{padding:8px 12px}.alert{padding:16px;background:#142635;border-left:3px solid #d8a75e}a{color:#9eddd4}
</style><main><h1>STORMWAKE V62 / AUTOQA</h1><p>自动测试证据与场景图集 · 运行于真实浏览器时才能验证 WebGPU 画面</p><div class="stat">'''
        html+=''.join('<span><b>'+str(report['counts'][k])+'</b>'+k+'</span>' for k in ['pass','fail','suspect','captured','unverified'])+'</div>'
        html+='<div class="alert"><b>验收边界：</b> 画面截图不会自动证明“3A 品质”。疑似海水穿透、Boss 光团及碰撞等必须结合游戏状态、录屏与截图复核。</div>'
        html+='<h2>逻辑 / 联机 / 浏览器检查</h2><table><thead><tr><th>检查</th><th>状态</th><th>说明</th></tr></thead><tbody>'+''.join(badges)+'</tbody></table>'
        html+='<h2>场景截图</h2><section class="gallery">'+''.join(screenshots)+'</section>'
        html+='<h2>调试附件</h2><p><a href="report.json">结构化报告 JSON</a> · <a href="captain_trace.zip">Chrome 调试轨迹（若存在）</a> · 视频目录：video/</p></main></html>'
        (out/'VISUAL_REPORT.html').write_text(html,encoding='utf-8')
        print('测试报告：',out/'REPORT_zh.md',flush=True)
        print('可视化图集：',out/'VISUAL_REPORT.html',flush=True)
    server=None; room_server=None; stdout_file=None; browser=None;contexts=[]
    try:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            result('playwright','fail','未安装 playwright；运行 python -m pip install playwright pillow')
            return 2
        if not args.existing:
            if check_port(args.port) or (not args.quick and check_port(5174)):
                result('ports','fail','所需端口已被占用；结束旧服务器或使用 --existing')
                return 2
            if not args.quick and not shutil.which('node'):
                result('node','fail','双人测试需要 Node.js 22+ 运行房间服务器')
                return 2
            stdout_file=(out/'server.log').open('w',encoding='utf-8')
            if not args.quick:
                room_server=subprocess.Popen([shutil.which('node'),str(ROOT/'server'/'coopServer.js')],cwd=ROOT,stdout=stdout_file,stderr=subprocess.STDOUT)
            cmd=[sys.executable,'-u',str(ROOT/'start_v60.py'),'--no-browser','--port',str(args.port),
                 '--mode','solo']
            server=subprocess.Popen(cmd,cwd=ROOT,stdout=stdout_file,stderr=subprocess.STDOUT)
        weburl=f'http://127.0.0.1:{args.port}'
        if not wait_url(weburl+'/',30):
            result('server','fail','游戏 HTTP 服务未能响应；查看 server.log')
            return 2
        result('server','pass',f'本地 HTTP {weburl}')
        if not args.quick and not wait_url('http://127.0.0.1:5174/api/crew/status',20):
            result('room_server','fail','5174 房间服务器未就绪')
            return 2
        if not args.quick:result('room_server','pass','真实 WebSocket 房间服务器已启动')
        headless=(not args.headed) if not args.headless else True
        if platform.system()=='Windows' and not args.headless:headless=False
        report['environment']['headless']=headless
        with sync_playwright() as pw:
            launches=[]
            if args.browser=='auto':
                launches=[{'channel':'chrome'},{'channel':'msedge'},{'executable_path':'/usr/bin/chromium'}]
            elif args.browser=='chromium':launches=[{'executable_path':'/usr/bin/chromium'}] if platform.system()!='Windows' else [{}]
            else:launches=[{'channel':args.browser}]
            last=None
            for cfg in launches:
                try:
                    browser=pw.chromium.launch(headless=headless,args=['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'],**cfg)
                    report['browser_verified']=True
                    result('browser_launch','pass',f'Chromium 配置 {cfg}')
                    break
                except Exception as e:last=e
            if not browser:
                result('browser_launch','fail',f'未能启动浏览器：{str(last)[:180]}')
                return 3
            def context(label):
                options={'viewport':{'width':1440,'height':900},'device_scale_factor':1}
                try:
                    c=browser.new_context(**options,record_video_dir=str(out/'video'),
                          record_video_size={'width':1440,'height':900})
                    page=c.new_page()
                except Exception as video_error:
                    # Playwright video requires its optional FFmpeg binary. Do
                    # not discard screenshot/trace and logical checks if missing.
                    try:c.close()
                    except Exception:pass
                    c=browser.new_context(**options);page=c.new_page()
                    result('video_setup_'+label,'unverified',
                           '无法录制视频（需安装 Playwright FFmpeg）；已回退至截图与 trace：'+str(video_error)[:105])
                c.tracing.start(screenshots=True,snapshots=True,sources=True)
                contexts.append((label,c))
                page.on('console',lambda msg:report['console_errors'].append({'client':label,'text':msg.text[:650]}) if msg.type=='error' else None)
                page.on('pageerror',lambda ex:report['page_errors'].append({'client':label,'error':str(ex)[:650]}))
                page.on('response',lambda r:report['network_errors'].append({'client':label,'status':r.status,'url':r.url[:300]}) if r.status>=400 else None)
                page.on('requestfailed',lambda r:report['network_errors'].append({'client':label,'url':r.url[:300],
                                                            'failure':str(r.failure)[:200]}))
                return page
            first=context('captain')
            params={'stormwake':1,'heritageShip':1,'qa':1,'seed':61015,'noAudio':1,'scale':args.render_scale,'maxFps':args.max_fps}
            if not args.quick:params.update({'coop':1,'room':'127.0.0.1:5174'})
            url=weburl+'/?'+urlencode(params)
            try:
                first.goto(url,wait_until='domcontentloaded',timeout=45000)
            except Exception as e:
                result('page_navigation','fail',f'无法加载游戏页面：{str(e)[:240]}')
                return 3
            try:
                first.wait_for_function('window.__stormwakeQA?.ready === true',timeout=args.timeout*1000)
                report['simulation_verified']=True
                result('game_initialization','pass','游戏引擎初始化并已安装开发诊断接口')
            except Exception as e:
                result('game_initialization','fail',f'在 {args.timeout} 秒内未进入可玩状态，参见页面错误与视频：{str(e)[:130]}')
                try:first.screenshot(path=str(out/'screenshots'/'initialization_failure.png'))
                except Exception:pass
                return 3
            try:
                first.keyboard.press('Enter')
                first.wait_for_function("window.__app.playState === 'playing' && !document.querySelector('.tw-start.is-on') && document.querySelector('.tw-start')?.hidden === true",timeout=8000)
                first.wait_for_timeout(800)
                result('start_overlay_dismissed','pass','截图开始前确认开场遮罩已退出')
            except Exception as e:
                result('start_overlay_dismissed','fail',f'遮罩未退出，禁止把遮挡截图判为合格: {str(e)[:190]}')
                return 3
            def snap(page):return page.evaluate('window.__stormwakeQA.snapshot()')
            def check_logic(page,label,peers=None):
                s=snap(page)
                opts={'expectPeers':peers,'expectConnected':peers is not None}
                a=page.evaluate('(options)=>window.__stormwakeQA.check(options)',opts)
                errs=a.get('failures',[])
                result('logic_'+label,'fail' if errs else 'pass',json.dumps(errs,ensure_ascii=False)[:300],s)
                return s
            def scene(page,name,who='captain'):
                try:
                    page.wait_for_function("window.__app.playState === 'playing' && document.querySelector('.tw-start')?.hidden === true",timeout=8000)
                    page.evaluate('(name)=>window.__stormwakeQA.go(name)',name)
                    page.wait_for_timeout(1400)
                    picture=out/'screenshots'/f'{who}_{name}.png'
                    page.screenshot(path=str(picture))
                    stat=image_metrics(picture);visual=verdict_visual(stat,name)
                    result('visual_'+who+'_'+name,visual['status'],visual['reason'],{'file':str(picture.relative_to(out)),**stat})
                    return check_logic(page,who+'_'+name,None) # other client has not joined yet
                except Exception as e:
                    result('scene_'+name,'fail',str(e)[:230]);return None
            check_logic(first,'startup',None)
            names=['spawn','dock','helm'] if args.quick and not args.all_scenes else ['spawn','dock','anchor','helm','cabin','lower_hold','beach','boss','open_sea']
            for name in names:
                state=scene(first,name,'captain')
                if name=='open_sea' and state:
                    off=state.get('offshore',{})
                    result('offshore_wildlife','pass' if off.get('active') and off.get('animalsVisible',0)>0 else 'fail',
                           f"远海生物激活={off.get('active')}；可见数量={off.get('animalsVisible',0)}")
            if args.route_cycles:
                traces=[]
                try:
                    first.evaluate("window.__stormwakeQA.go('lower_entry')");first.wait_for_timeout(300)
                    start=snap(first)['player']['deckPosition']
                    first.keyboard.press('e');first.wait_for_function('window.__stormwakeQA.snapshot().player.climbing',timeout=4000)
                    first.wait_for_timeout(250);first.keyboard.press('Escape')
                    first.wait_for_function("!window.__stormwakeQA.snapshot().player.climbing && window.__stormwakeQA.snapshot().player.deckLayer==='deck'",timeout=6000)
                    end=snap(first)['player']['deckPosition']
                    drift=sum((end[k]-start[k])**2 for k in ('x','y','z'))**.5
                    result('ladder_cancel_returns','pass' if drift<.08 else 'fail',f'实际 E 下梯、Esc 原路返回；起点误差 {drift:.4f}m')
                except Exception as e:result('ladder_cancel_returns','fail',str(e)[:230])
                for route,entry,layer in [('cargo','lower_entry','lowerHold'),('cabin','cabin_entry','hold')]:
                    try:
                        first.evaluate('(s)=>window.__stormwakeQA.go(s)',entry)
                        first.wait_for_timeout(300)
                        for cycle in range(args.route_cycles):
                            if route=='cabin' and not first.evaluate('window.__app.boat.originalDoor.passable'):
                                first.keyboard.press('e');first.wait_for_function('window.__app.boat.originalDoor.passable',timeout=4000)
                            first.keyboard.press('e')
                            first.wait_for_function('(layer)=>window.__stormwakeQA.snapshot().player.deckLayer===layer && !window.__stormwakeQA.snapshot().player.climbing',arg=layer,timeout=8000)
                            inside=snap(first)
                            if cycle==0 and route=='cargo':
                                start=inside['player']['deckPosition']
                                first.keyboard.down('w');first.wait_for_timeout(500);first.keyboard.up('w')
                                moved=snap(first)['player']['deckPosition']
                                distance=((moved['x']-start['x'])**2+(moved['z']-start['z'])**2)**.5
                                first.keyboard.down('s');first.wait_for_timeout(500);first.keyboard.up('s')
                                result('hold_keyboard_walk','pass' if distance>.1 else 'fail',f'真实 W 在货舱内移动 {distance:.3f}m；BVH={inside["player"].get("collision")}')
                                water=inside['water']
                                result('dry_hold_medium','pass' if water['dryCamera'] and not water['underwaterPost'] and water['oceanVisible'] else 'fail','干舱镜头使用空气，外部海洋保持绘制',water)
                            if cycle==0:first.screenshot(path=str(out/'screenshots'/f'route_{route}_inside.png'))
                            first.keyboard.press('e')
                            first.wait_for_function("window.__stormwakeQA.snapshot().player.deckLayer==='deck' && !window.__stormwakeQA.snapshot().player.climbing",timeout=8000)
                            outside=snap(first)
                            traces.append({'route':route,'cycle':cycle+1,'inside':inside,'outside':outside})
                        result('route_'+route+'_repeated','pass',f'{args.route_cycles} 次连续真实 E 往返；未在循环中传送',{'cycles':len([t for t in traces if t['route']==route])})
                    except Exception as e:
                        result('route_'+route+'_repeated','fail',str(e)[:230],first.evaluate('window.__stormwakeQA.interactionTrace()'))
                        first.screenshot(path=str(out/'screenshots'/f'route_{route}_failure.png'))
                (out/'route_traces.json').write_text(json.dumps(traces,ensure_ascii=False,indent=2),encoding='utf-8')
            if not args.quick:
                # Real keyboard interactions rather than patching the station
                # state directly. Fail if the prompt cannot be reached/claimed.
                for station in ('anchor','helm'):
                    try:
                        first.evaluate('(s)=>window.__stormwakeQA.go(s)',station)
                        first.wait_for_timeout(250)
                        first.keyboard.press('e')
                        first.wait_for_timeout(300)
                        actual=snap(first)['player']['station']
                        claimed=bool(actual and (actual.startswith('anchor') if station=='anchor' else actual=='helm'))
                        result('interact_'+station,'pass' if claimed else 'fail',
                               f'真实按键 E 取得岗位={actual!r}')
                        if claimed and station=='anchor':
                            before=snap(first)['ship']['anchor']['travel']
                            first.keyboard.down('w');first.wait_for_timeout(1700);first.keyboard.up('w')
                            first.wait_for_timeout(300)
                            after=snap(first)['ship']['anchor']['travel']
                            result('anchor_winding','pass' if after < before-.035 else 'fail',
                                   f'真实按键 W 绞盘行程：{before:.3f} -> {after:.3f}')
                        if claimed:first.keyboard.press('e')
                    except Exception as e:
                        result('interact_'+station,'fail',str(e)[:200])
            if not args.quick:
                second=context('crew')
                try:
                    second.bring_to_front()
                    second.goto(url,wait_until='domcontentloaded',timeout=45000)
                    second.wait_for_function('window.__stormwakeQA?.ready === true',timeout=args.timeout*1000)
                    second.keyboard.press('Enter')
                    second.wait_for_function("window.__app.playState === 'playing' && document.querySelector('.tw-start')?.hidden === true",timeout=8000)
                    second.wait_for_timeout(1200)
                    a,b=check_logic(first,'captain_connected',1),check_logic(second,'crew_connected',1)
                    if a['multiplayer']['connected'] and b['multiplayer']['connected']:
                        result('two_clients','pass','两个真正的 WebGPU 游戏上下文都已接入同一房间')
                    else:result('two_clients','fail','一个或两个真实客户端未加入房间')
                    second.bring_to_front()
                    second.evaluate('(name)=>window.__stormwakeQA.go(name)','spawn')
                    before=snap(second)['player']['position'];remote_before=snap(first)['multiplayer']['peers'];second.keyboard.down('w');second.wait_for_timeout(850);second.keyboard.up('w')
                    second.wait_for_timeout(750)
                    after=snap(second)['player']['position'];motion=((after['x']-before['x'])**2+(after['z']-before['z'])**2)**.5
                    result('keyboard_movement','pass' if motion>.1 else 'fail',f'真实键盘移动距离 {motion:.2f} 米')
                    second.wait_for_timeout(750)
                    peer_a=snap(first)['multiplayer']['peers'];peer_b=snap(second)['multiplayer']['peers']
                    if peer_a and peer_b and all(p['visible'] and p['position'] for p in peer_a+peer_b):
                        result('remote_avatar','pass','双方玩家都有真实可见的远端角色对象（需视频检查动作质量）')
                        prior=remote_before[0]['target'] if remote_before else None
                        now=peer_a[0]['target']
                        delta=((now['x']-prior['x'])**2+(now['z']-prior['z'])**2)**.5 if prior and now else 0
                        gap=((now['x']-after['x'])**2+(now['z']-after['z'])**2)**.5 if now else float('inf')
                        result('remote_live_motion','pass' if delta>.1 and gap<2 else 'fail',
                            f'远端目标更新位移 {delta:.2f}m；与真实玩家位置误差 {gap:.2f}m',
                            {'before':prior,'after':now,'real':after})
                    else:result('remote_avatar','fail','远端人偶不存在、不可见或坐标丢失')
                    # Time-change is requested by the actual room owner and must
                    # pass via WebSocket, not a local-only App.settings mutation.
                    host=first if first.evaluate('window.__app.crew.isHost') else second
                    other=second if host is first else first
                    accepted=host.evaluate('window.__stormwakeQA.setHour(21.4)')
                    host.wait_for_timeout(1600)
                    h1=snap(host)['world'];h2=snap(other)['world']
                    gap=min(abs(h1['hour']-h2['hour']),24-abs(h1['hour']-h2['hour']))
                    weather_gap=abs(h1['weatherSeconds']-h2['weatherSeconds'])
                    result('shared_world_time_weather','pass' if accepted and gap<.08 and weather_gap<2.5 else 'fail',
                           f'房间昼夜偏差 {gap:.4f} 小时；天气时轴偏差 {weather_gap:.3f} 秒',{'host':h1,'peer':h2})
                    for page,who in [(first,'captain'),(second,'crew')]:
                        picture=out/'screenshots'/f'{who}_multiplayer_night.png'
                        page.screenshot(path=str(picture));st=image_metrics(picture)
                        result('night_'+who,verdict_visual(st,'night')['status'],'双机夜景截图已采样',st)
                    if args.clients>2:
                        crew_pages=[first,second]
                        for number in range(3,args.clients+1):
                            page=context('crew'+str(number));page.bring_to_front();page.goto(url,wait_until='domcontentloaded',timeout=45000)
                            page.wait_for_function('window.__stormwakeQA?.ready === true',timeout=args.timeout*1000)
                            page.keyboard.press('Enter');page.wait_for_function("window.__app.playState==='playing' && document.querySelector('.tw-start')?.hidden===true",timeout=8000)
                            crew_pages.append(page)
                        for page in crew_pages:
                            page.wait_for_function('(n)=>window.__stormwakeQA.snapshot().multiplayer.peerCount===n',arg=args.clients-1,timeout=12000)
                        result('real_'+str(args.clients)+'_clients','pass',f'{args.clients} 个独立 WebGPU 页面同房间，各有 {args.clients-1} 名远端角色')
                        for seat_index,page in enumerate(crew_pages):
                            page.evaluate("s=>window.__stormwakeQA.go(s)",["anchor","anchor_2","anchor_3","anchor_4"][seat_index]);page.wait_for_timeout(350);page.keyboard.press('e')
                            page.wait_for_function("window.__stormwakeQA.snapshot().player.station?.startsWith('anchor')",timeout=6000)
                        ids=[snap(page)['player']['station'] for page in crew_pages]
                        result('capstan_distinct_seats','pass' if len(set(ids))==args.clients else 'fail',str(ids))
                        actual_host=next(page for page in crew_pages if page.evaluate('window.__app.crew.isHost'))
                        before=snap(actual_host)['ship']['anchor']['travel']
                        for page in crew_pages:page.keyboard.down('w')
                        actual_host.wait_for_timeout(300)
                        working=snap(actual_host)['ship']['anchor']
                        for page in crew_pages:page.keyboard.up('w')
                        actual_host.wait_for_timeout(500)
                        after=snap(actual_host)['ship']['anchor']
                        result('cooperative_capstan','pass' if working['hands']==args.clients and after['travel']<before-.05 else 'fail',f"实按 W：hands={working['hands']}，行程 {before:.3f} -> {after['travel']:.3f}")
                        actual_host.wait_for_timeout(500);stopped=snap(actual_host)['ship']['anchor']
                        result('capstan_release_stops','pass' if stopped['hands']==0 and abs(stopped['turns']-after['turns'])<.01 else 'fail',f"松键后 hands={stopped['hands']}，绞盘转角变化 {abs(stopped['turns']-after['turns']):.4f}")
                        for i,page in enumerate(crew_pages):page.screenshot(path=str(out/'screenshots'/f'four_capstan_{i+1}.png'))
                        for page in crew_pages:page.wait_for_function('!!window.__app.boat.heritageArt?.anchorRig',timeout=15000)
                        result('physical_anchor_all_clients','pass','全部实际 WebGPU 页面已装载实体锚和锚链')
                        # Protocol fixture: the host changes HP; this verifies replication,
                        # separately from ballistic hit tests in the Node regression suite.
                        actual_host.evaluate("window.__app.voyageM1.ghostFleet.hit('v44_ghost_9',7)")
                        actual_host.wait_for_timeout(1200)
                        fleet_hp=[snap(page)['offshore']['fleet'][9]['hp'] for page in crew_pages]
                        result('spectral_hp_replication','pass' if all(h==63 for h in fleet_hp) else 'fail',str(fleet_hp))
                        prior_fleet=snap(actual_host)['offshore']['fleet']
                        prior=snap(actual_host)['ship']['position'];actual_host.close()
                        survivors=[page for page in crew_pages if page is not actual_host]
                        survivors[0].wait_for_function('window.__app.voyageM1.net.hostId && window.__app.voyageM1.net.hostId!==null',timeout=8000)
                        survivors[0].wait_for_timeout(1500)
                        hosts=[page for page in survivors if page.evaluate('window.__app.crew.isHost')]
                        now=snap(hosts[0])['ship']['position'] if hosts else prior
                        delta=((now['x']-prior['x'])**2+(now['z']-prior['z'])**2)**.5
                        result('host_handoff','pass' if len(hosts)==1 and delta<5 else 'fail',f'剩余客户端房主数 {len(hosts)}；船位变化 {delta:.3f}m')
                        retained=snap(hosts[0])['offshore']['fleet'][9]['hp'] if hosts else None
                        result('spectral_handoff','pass' if retained==63 else 'fail',f'迁移后幽灵舰 HP={retained}')
                except Exception as e:
                    diagnostic=[]
                    for label,ctx in contexts:
                        for page in ctx.pages:
                            try:
                                diagnostic.append({'client':label,'state':page.evaluate("({playState:window.__app?.playState,loader:document.querySelector('#loader')?.innerText})")})
                                page.screenshot(path=str(out/'screenshots'/f'{label}_sequence_failure.png'),timeout=8000)
                            except Exception:pass
                    result('two_client_sequence','fail',str(e)[:300],diagnostic)
            if report['page_errors']:result('runtime_errors','fail',str(report['page_errors'])[:250])
            if report['network_errors']:result('http_resources','fail',str(report['network_errors'])[:250])
            # A test suite with any fail must return a nonzero code for CI.
            return 1 if any(t['status']=='fail' for t in report['tests']) else 0
    except Exception as e:
        result('runner_exception','fail',f'{type(e).__name__}: {e}')
        return 5
    finally:
        for label,ctx in contexts:
            try:ctx.tracing.stop(path=str(out/f'{label}_trace.zip'))
            except Exception:pass
            try:ctx.close()
            except Exception:pass
        if browser:
            try:browser.close()
            except Exception:pass
        if server and server.poll() is None:
            server.terminate()
            try:server.wait(timeout=6)
            except subprocess.TimeoutExpired:server.kill()
        if room_server and room_server.poll() is None:
            room_server.terminate()
            try:room_server.wait(timeout=6)
            except subprocess.TimeoutExpired:room_server.kill()
        if stdout_file:stdout_file.close()
        save_report()

if __name__=='__main__':sys.exit(main())
