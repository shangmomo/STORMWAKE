"""Run STORMWAKE V50 Dutch Ship + sourced Captain Quarters (no Vite dependency)."""
import argparse
import http.server
import threading
import webbrowser
from start_v38 import TidewaterHandler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=5173)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    with http.server.ThreadingHTTPServer(('127.0.0.1', args.port), TidewaterHandler) as server:
        url = f'http://127.0.0.1:{server.server_port}/?stormwake=1&heritageShip=1'
        print('STORMWAKE V50 complete project:', url, flush=True)
        print('V50 is source/regression-tested; browser WebGPU image QA is not certified.', flush=True)
        if not args.no_browser:
            threading.Timer(0.5, lambda: webbrowser.open(url)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
