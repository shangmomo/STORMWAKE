"""Start the LAN multiplayer room and local WebGPU game page (Windows/Python)."""
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from scripts.install_hydra import ensure_hydra


def lan_ip():
    """No network data is sent: UDP connect only discovers the local interface."""
    udp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        udp.connect(("192.0.2.1", 80))
        return udp.getsockname()[0]
    except OSError:
        return "主机的局域网IP"
    finally:
        udp.close()


def ready(url):
    try:
        with urllib.request.urlopen(url, timeout=0.4) as response:
            return 200 <= response.status < 300
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def main():
    root = Path(__file__).resolve().parent
    ensure_hydra(root)
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    node = shutil.which("node.exe") or shutil.which("node")
    if not npm or not node:
        print("请安装 Node.js（包含 npm），并确保 python 和 node 在 PATH 中。")
        return 1
    if not (root / "node_modules" / "vite").exists():
        print("首次启动：安装项目依赖……")
        subprocess.run([npm, "install"], cwd=root, check=True)
    print("构建多人版本（首次约需十几秒）……")
    subprocess.run([npm, "run", "build"], cwd=root, check=True)
    hub = subprocess.Popen([node, "server/coopServer.js"], cwd=root)
    browser = subprocess.Popen([npm, "run", "dev", "--", "--host", "127.0.0.1"], cwd=root)
    address = lan_ip()
    try:
        for _ in range(65):
            if hub.poll() is not None or browser.poll() is not None:
                print("房间服务器或游戏页面提前退出，请查看以上日志。")
                return 1
            if ready("http://127.0.0.1:5174/api/crew/status") and ready("http://127.0.0.1:5173/"):
                url = "http://127.0.0.1:5173/?coop=1"
                print("\n✅ 多人房间已启动：", address + ":5174")
                print("✅ 本机游戏已启动：", url)
                print("\n邀请好友：")
                print("1. 好友在自己的电脑运行 run_windows.py，打开自己的 localhost。")
                print("2. 点击左上角 👥 船员联机，在「房间服务器」输入：", address + ":5174")
                print("3. 加入房间即可共享巨兽战斗与船员位置。")
                print("如果无法连接，请允许 Windows 防火墙开放 TCP 5174。")
                print("注意：普通 HTTP 局域网 IP 不保证支持 WebGPU，好友应在自己的 localhost 打开游戏。")
                print("\n停止服务请按 Ctrl+C。")
                webbrowser.open(url)
                while hub.poll() is None and browser.poll() is None:
                    time.sleep(0.4)
                return 1
            time.sleep(0.2)
        print("启动超时；请检查端口 5173/5174 是否已被占用。")
        return 1
    except KeyboardInterrupt:
        print("\n正在关闭联机服务……")
        return 0
    finally:
        for p in (hub, browser):
            if p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=4)
                except subprocess.TimeoutExpired:
                    p.kill()


if __name__ == "__main__":
    sys.exit(main())
