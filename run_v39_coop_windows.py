"""STORMWAKE V39 M1 LAN host launcher — requires only Python 3 and Node.js.

The locally served WebGPU page stays on localhost (secure browser origin).
Other players use their own local start_v38.py and connect by the host's LAN IP.
No Vite, npm install, cloud account, relay or external API required.
"""
from __future__ import annotations
import argparse
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def lan_ip():
    s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
    try:
        s.connect(('192.0.2.1',80))
        return s.getsockname()[0]
    except OSError:
        return 'HOST_LAN_IP'
    finally:
        s.close()

def healthy(url):
    try:
        with urllib.request.urlopen(url,timeout=.5) as r:return r.status==200
    except Exception:return False

def main():
    ap=argparse.ArgumentParser(description='STORMWAKE LAN co-op M1')
    ap.add_argument('--web-port',type=int,default=5173)
    ap.add_argument('--hub-port',type=int,default=5174)
    ap.add_argument('--no-browser',action='store_true')
    args=ap.parse_args()
    import shutil
    node=shutil.which('node')
    if not node:
        print('请先安装 Node.js 20+；仅 Python 不足以运行联机房间。')
        return 2
    hub=subprocess.Popen([node,'server/coopServer.js'],cwd=ROOT,env={**__import__('os').environ,'TIDEWATER_COOP_PORT':str(args.hub_port)})
    local=subprocess.Popen([sys.executable,'start_v38.py','--port',str(args.web_port),'--no-browser'],cwd=ROOT)
    try:
        for _ in range(45):
            if hub.poll() is not None or local.poll() is not None:
                print('联机服务或网页进程提前退出，请检查端口占用。');return 1
            if healthy(f'http://127.0.0.1:{args.web_port}/') and healthy(f'http://127.0.0.1:{args.hub_port}/api/crew/status'):
                ip=lan_ip()
                host_url=f'http://127.0.0.1:{args.web_port}/?stormwake=1&coop=1&room=127.0.0.1:{args.hub_port}'
                guest_url=f'http://127.0.0.1:{args.web_port}/?stormwake=1&coop=1&room={ip}:{args.hub_port}'
                print('\nSTORMWAKE V39 · 局域网协作 M1 就绪')
                print('房主本机打开：',host_url)
                print('房主 LAN 地址：',ip+':'+str(args.hub_port))
                print('好友各自在自己的电脑解压完整 ZIP，运行 python start_v38.py')
                print('然后在好友电脑的 Chrome/Edge 中打开：',guest_url)
                print('各自保持 localhost WebGPU 页面。请开放房主 Windows TCP 5174 防火墙。')
                print('提示：首次使用请在网页左侧「船员联机」确认状态，再进入甲板。按 Ctrl+C 停止。\n')
                if not args.no_browser:webbrowser.open(host_url)
                while hub.poll() is None and local.poll() is None:time.sleep(.35)
                print('联机进程意外退出。');return 1
            time.sleep(.3)
        print('服务启动超时，检查 5173 和 5174 是否已被使用。');return 1
    except KeyboardInterrupt:
        print('正在关闭联机房间。');return 0
    finally:
        for p in (hub,local):
            if p.poll() is None:
                p.terminate()
                try:p.wait(timeout=3)
                except subprocess.TimeoutExpired:p.kill()

if __name__=='__main__':raise SystemExit(main())
