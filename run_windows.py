"""Launch Tidewater's local Vite server using Python, without shell scripts."""
from pathlib import Path
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from scripts.install_hydra import ensure_hydra


def main():
    root = Path(__file__).resolve().parent
    ensure_hydra(root)
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        print("未找到 npm。请先安装 Node.js（包含 npm），然后重新运行此文件。")
        return 1
    if not (root / "node_modules" / "vite").exists():
        print("首次启动：安装项目依赖……")
        subprocess.run([npm, "install"], cwd=root, check=True)
    command = [npm, "run", "dev", "--", "--host", "127.0.0.1"]
    print("启动潮汐海岛……")
    server = subprocess.Popen(command, cwd=root)
    url = "http://127.0.0.1:5173/"
    try:
        for _ in range(45):
            if server.poll() is not None:
                print("服务器提前退出，请检查上面的错误提示。")
                return server.returncode
            try:
                with urllib.request.urlopen(url, timeout=1):
                    webbrowser.open(url)
                    print("已打开游戏：", url)
                    print("要停止服务器，请在当前终端按 Ctrl+C。")
                    return server.wait()
            except (urllib.error.URLError, TimeoutError):
                time.sleep(0.2)
        print("服务器启动超时，请检查端口 5173 是否被占用。")
        return 1
    except KeyboardInterrupt:
        print("\n正在关闭本地服务……")
        return 0
    finally:
        if server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=4)
            except subprocess.TimeoutExpired:
                server.kill()


if __name__ == "__main__":
    sys.exit(main())
