"""Launch Node WebSocket host and local browser on localhost; no npm dependency."""
import subprocess,sys,shutil,socket
from start_v54 import main as open_game

def main():
    node=shutil.which('node')
    if not node:
        print('Node.js 22+ required for cooperative host.');return 1
    peer=subprocess.Popen([node,'server/coopServer.js'])
    try:
        print('LAN room listens on TCP 5174. Friends use START_STORMWAKE_V54.cmd on their own PCs, then enter host LAN-IP:5174 in Crew panel.');print('Allow port 5174 through firewall.');
        sys.argv=[sys.argv[0],'--coop'];open_game();return 0
    finally:
        if peer.poll() is None:
            peer.terminate();peer.wait(timeout=5)
if __name__=='__main__':sys.exit(main())
