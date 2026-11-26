"""Tidewater V38 offline-safe local launcher.

Runs the authored browser ES-module game directly with no npm/Vite install.
The development-only MIME/CSS transform is intentionally narrow: it replaces
CSS side-effect imports with stylesheet tags and supplies import.meta.env.
The game still requires a WebGPU-capable Edge/Chrome browser.

Usage: python start_v38.py [--port 5173] [--no-browser]
"""
from __future__ import annotations
import argparse
import functools
import http.server
import mimetypes
import pathlib
import re
import threading
import webbrowser
from urllib.parse import urljoin, unquote, urlsplit

ROOT=pathlib.Path(__file__).resolve().parent
CSS_IMPORT=re.compile(r"^\s*import\s+['\"]([^'\"]+\.css)['\"]\s*;?\s*$",re.MULTILINE)
mimetypes.add_type('model/gltf-binary','.glb')
mimetypes.add_type('text/javascript','.js')
mimetypes.add_type('application/wasm','.wasm')
mimetypes.add_type('application/octet-stream','.bin')


def transform_js(source:str, url:str)->str:
    def css(match):
        href=urljoin(url,match.group(1))
        # Only filesystem-relative imports from our own code are rewritten.
        if not href.startswith('/src/') or not href.endswith('.css'):
            raise ValueError('Invalid CSS import in '+url)
        return ("if(!document.querySelector('link[data-tidewater-css=\"" +href+ "\"]')) {"
            "const link=document.createElement('link');link.rel='stylesheet';"
            "link.href='"+href+"';link.dataset.tidewaterCss='"+href+"';"
            "document.head.appendChild(link);}")
    source=CSS_IMPORT.sub(css,source)
    return source.replace('import.meta.env',"({BASE_URL:'/',DEV:true,PROD:false,MODE:'development'})")

class TidewaterHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT),**kwargs)
    def translate_path(self,path):
        # Vite's public/ directory is exposed as the HTTP root. Preserve its
        # URLs so installed GLBs, textures and UI artwork resolve identically.
        raw=unquote(urlsplit(path).path)
        # Vite serves every file in public/ from the HTTP root (not merely
        # models, textures and UI images). Prefer real source files, then
        # resolve the same URL under public/ for asset requests.
        real=pathlib.Path(super().translate_path(path))
        if real.is_file() or real.is_dir():
            return str(real)
        public=pathlib.Path(super().translate_path('/public'+raw))
        if public.is_file() or public.is_dir():
            return str(public)
        return str(real)
    def do_GET(self):
        request_path=unquote(urlsplit(self.path).path)
        if request_path == '/api/guide/status':
            data=b'{"configured":false,"mode":"offline"}'
            self.send_response(200)
            self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Content-Length',str(len(data)))
            self.send_header('Cache-Control','no-store')
            self.end_headers();self.wfile.write(data)
            return
        if request_path == '/favicon.ico':
            self.send_response(204);self.end_headers();return
        if request_path.startswith('/src/') and request_path.endswith('.js'):
            try:
                path=pathlib.Path(self.translate_path(request_path)).resolve()
                path.relative_to(ROOT)
                if not path.is_file(): raise FileNotFoundError(path)
                data=transform_js(path.read_text(encoding='utf-8'),request_path).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type','text/javascript; charset=utf-8')
                self.send_header('Content-Length',str(len(data)))
                self.send_header('Cache-Control','no-store')
                self.end_headers();self.wfile.write(data)
            except (OSError,ValueError) as exc:
                self.send_error(404,'Cannot serve module: '+str(exc))
            return
        return super().do_GET()
    def log_message(self,format,*args):
        if args and str(args[1]) in ('200','304'): return
        super().log_message(format,*args)

class TidewaterHTTPServer(http.server.ThreadingHTTPServer):
    # Each page imports hundreds of ES modules. The socketserver default
    # backlog of five can drop connections during parallel client startup.
    request_queue_size=128
    daemon_threads=True

def main():
    ap=argparse.ArgumentParser(description='Launch Tidewater V38 without npm')
    ap.add_argument('--port',type=int,default=5173)
    ap.add_argument('--no-browser',action='store_true')
    args=ap.parse_args()
    host='127.0.0.1'
    with TidewaterHTTPServer((host,args.port),TidewaterHandler) as server:
        url=f'http://{host}:{server.server_port}/'
        print('STORMWAKE V41 Ship Reliability Repair (V38 launcher compatible) —',url,flush=True)
        print('Open in current Edge/Chrome (WebGPU required). Ctrl+C to stop.',flush=True)
        if not args.no_browser: threading.Timer(.5,lambda:webbrowser.open(url)).start()
        try:server.serve_forever()
        except KeyboardInterrupt:pass

if __name__=='__main__': main()
