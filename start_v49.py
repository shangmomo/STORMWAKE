"""Start STORMWAKE V49 original Dutch Ship from a local Python HTTP server."""
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
        print('STORMWAKE V49 original uncut Dutch Ship', url, flush=True)
        print('Browser GPU image/physics acceptance remains pending.', flush=True)
        if not args.no_browser:
            threading.Timer(0.5, lambda: webbrowser.open(url)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
