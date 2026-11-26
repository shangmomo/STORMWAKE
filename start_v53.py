"""Run STORMWAKE V53 offline-safe WebGPU source via the V38 Python asset handler."""
import argparse
import http.server
import threading
import webbrowser
from start_v38 import TidewaterHandler


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=5173)
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    with http.server.ThreadingHTTPServer(('127.0.0.1',args.port),TidewaterHandler) as server:
        url=f'http://127.0.0.1:{server.server_port}/?stormwake=1&heritageShip=1'
        print('STORMWAKE V53 — genuine cargo hatch, independent hold, operable weapons:',url,flush=True)
        print('Requires latest Chrome/Edge with WebGPU. Ctrl+C to stop. Tests: npm run test:v53',flush=True)
        if not args.no_browser:
            threading.Timer(.5,lambda:webbrowser.open(url)).start()
        try:server.serve_forever()
        except KeyboardInterrupt:pass

if __name__=='__main__':main()
