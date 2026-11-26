"""Offline HTTP smoke test for the V38 one-click launcher (no npm needed)."""
import contextlib
import hashlib
import http.server
from pathlib import Path
import sys
import threading
from urllib.request import urlopen
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import start_v38

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), start_v38.TidewaterHandler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
try:
    base = f'http://127.0.0.1:{server.server_port}'
    for resource, expected in (
        ('/', b'TIDEWATER'),
        ('/src/main.js', b'link.dataset.tidewaterCss'),
        ('/src/land/LandRigRuntime.js', b'v38_pirate_cast_manifest.json'),
        ('/models/land/v38_pirate_cast_manifest.json', b'pirate_captain.glb'),
        ('/models/land/pirate_captain.glb', b'glTF'),
        ('/ui/keyart-720.jpg', b'\xff\xd8'),
        ('/xiaoxi-guide.png', b'\x89PNG'),
        ('/src/land/land-adventure.css', b'land'),
    ):
        with contextlib.closing(urlopen(base + resource, timeout=12)) as response:
            data = response.read()
            assert response.status == 200, (resource, response.status)
            assert expected.lower() in data.lower(), (resource, 'missing content signature')
    with contextlib.closing(urlopen(base + '/src/main.js')) as response:
        data = response.read()
        assert b"import.meta.env" not in data
        assert b"import './land/land-adventure.css'" not in data
    print('V38 HTTP PASS: homepage, transformed JS, CSS, manifest, GLB, UI images; no Vite dependency.')
finally:
    server.shutdown()
    server.server_close()
