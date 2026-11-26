"""Exercise real HTTP keep-alive and a burst of concurrent ES module requests."""
import concurrent.futures
import http.client
from pathlib import Path
import sys
import threading
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from start_v38 import TidewaterHandler,TidewaterHTTPServer

class LauncherTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=TidewaterHTTPServer(('127.0.0.1',0),TidewaterHandler)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join(timeout=2)
    def fetch(self,path):
        c=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=8)
        try:
            c.request('GET',path);r=c.getresponse();body=r.read()
            self.assertEqual(r.status,200,path)
            return body
        finally:c.close()
    def test_keep_alive_and_offline_capability(self):
        c=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=8)
        try:
            c.request('GET','/api/guide/status');r=c.getresponse()
            self.assertEqual(r.status,200);self.assertIn(b'"configured":false',r.read());sock=c.sock
            c.request('GET','/src/main.js');r=c.getresponse()
            self.assertEqual(r.status,200);self.assertIn(b"awaiting_start",r.read());self.assertIs(c.sock,sock)
        finally:c.close()
    def test_parallel_required_module_startup(self):
        paths=['/src/ship/CrewNavigation.js','/src/engine/render/MeshShader.js','/src/world/village/HarborLettering.js','/src/main.js']*40
        with concurrent.futures.ThreadPoolExecutor(max_workers=48) as pool:
            bodies=list(pool.map(self.fetch,paths))
        self.assertTrue(all(len(body)>100 for body in bodies))
        self.assertIn(b"link.rel='stylesheet'",bodies[3])

if __name__=='__main__':unittest.main(verbosity=2)
