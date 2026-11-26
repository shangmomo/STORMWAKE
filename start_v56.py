"""STORMWAKE V56 - one launcher, choose solo / LAN host / LAN join.
Python 3.10+, Chrome or Edge with WebGPU; host also requires Node.js 22+.
"""
import argparse
import http.server
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from urllib.parse import urlencode
from start_v38 import TidewaterHandler

ROOT=Path(__file__).resolve().parent

def choose_mode():
    try:
        import tkinter as tk
        from tkinter import messagebox
        root=tk.Tk();root.title('STORMWAKE V56 · 启动海上冒险')
        root.geometry('460x290');root.resizable(False,False)
        root.configure(bg='#172d37')
        state={'mode':None,'room':'127.0.0.1:5174'}
        tk.Label(root,text='STORMWAKE · 游戏启动',font=('Microsoft YaHei UI',17,'bold'),bg='#172d37',fg='#f6e0ae').pack(pady=(22,13))
        tk.Label(root,text='单人不需要 Node.js；多人最多 4 人（局域网）',bg='#172d37',fg='#b8d7d1').pack()
        room=tk.StringVar(value='192.168.1.20:5174')
        row=tk.Frame(root,bg='#172d37');row.pack(pady=12)
        tk.Label(row,text='房主 IP:端口',bg='#172d37',fg='#e6e6e6').pack(side='left',padx=5)
        tk.Entry(row,textvariable=room,width=23).pack(side='left')
        buttons=tk.Frame(root,bg='#172d37');buttons.pack(pady=10)
        def launch(mode):
            address=room.get().strip()
            if mode=='join' and (':' not in address or '/' in address or ' ' in address):
                messagebox.showerror('联机地址','请填写房主的局域网 IP:5174');return
            state.update(mode=mode,room=address);root.destroy()
        for title,mode in [('单人开始','solo'),('多人·创建房间','host'),('多人·加入房间','join')]:
            tk.Button(buttons,text=title,command=lambda m=mode:launch(m),bg='#a9824f',fg='#101b23',width=14,relief='flat',font=('Microsoft YaHei UI',10,'bold')).pack(side='left',padx=4)
        root.protocol('WM_DELETE_WINDOW',root.destroy);root.mainloop()
        return state['mode'],state['room']
    except Exception as e:
        print('Unable to open graphical launcher:',e,file=sys.stderr)
        return None,None

def main(argv=None):
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--mode',choices=['solo','host','join'])
    ap.add_argument('--room',default='127.0.0.1:5174')
    ap.add_argument('--port',type=int,default=5173)
    ap.add_argument('--no-browser',action='store_true')
    args=ap.parse_args(argv)
    os.chdir(ROOT)
    mode,room=(args.mode,args.room) if args.mode else choose_mode()
    if not mode:return 0
    peer=None
    try:
        if mode=='host':
            node=shutil.which('node')
            if not node:
                print('多人房主需要 Node.js 22+。可用单人模式启动。',file=sys.stderr);return 1
            peer=subprocess.Popen([node,str(ROOT/'server'/'coopServer.js')],cwd=ROOT)
            room='127.0.0.1:5174'
            # Ensure the room server is genuinely listening before giving the
            # user a game window. A dead/blocked port must fail visibly.
            ready=False
            for _ in range(50):
                if peer.poll() is not None:break
                try:
                    with urllib.request.urlopen('http://127.0.0.1:5174/api/crew/status',timeout=.25) as response:
                        ready=response.status==200
                    if ready:break
                except Exception:time.sleep(.10)
            if not ready:
                print('多人房间创建失败：5174 端口被占用或 Node 服务器未成功启动。',file=sys.stderr)
                return 2
        params={'stormwake':1,'heritageShip':1}
        if mode!='solo':params.update(coop=1,room=room)
        with http.server.ThreadingHTTPServer(('127.0.0.1',args.port),TidewaterHandler) as server:
            url=f'http://127.0.0.1:{server.server_port}/?{urlencode(params)}'
            print(f'STORMWAKE V56 ({mode}) : {url}',flush=True)
            if mode=='host':
                print('房主：TCP 5174；其他玩家选择【多人·加入房间】，填入本机局域网 IPv4:5174。',flush=True)
                print('注意 Windows 防火墙必须允许 5174 TCP。',flush=True)
            if not args.no_browser:threading.Timer(.65,lambda:webbrowser.open(url)).start()
            try:server.serve_forever()
            except KeyboardInterrupt:pass
        return 0
    finally:
        if peer and peer.poll() is None:
            peer.terminate()
            try:peer.wait(timeout=4)
            except subprocess.TimeoutExpired:peer.kill()

if __name__=='__main__':sys.exit(main())
