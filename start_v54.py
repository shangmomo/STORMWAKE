"""STORMWAKE V54: direct source server; localhost WebGPU supported by Chrome/Edge."""
import argparse, http.server, threading, webbrowser
from start_v38 import TidewaterHandler

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--port',type=int,default=5173)
    ap.add_argument('--no-browser',action='store_true')
    ap.add_argument('--coop',action='store_true')
    a=ap.parse_args()
    with http.server.ThreadingHTTPServer(('127.0.0.1',a.port),TidewaterHandler) as server:
        url=f'http://127.0.0.1:{server.server_port}/?stormwake=1&heritageShip=1'+('&coop=1' if a.coop else '')
        print('STORMWAKE V54 game:',url,flush=True)
        if not a.no_browser: threading.Timer(.5,lambda:webbrowser.open(url)).start()
        try: server.serve_forever()
        except KeyboardInterrupt:pass
if __name__=='__main__':main()
