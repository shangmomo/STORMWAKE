"""Cross-platform Stormwake V28 launcher; run with: python start_v28.py.

Requires Node.js and npm; installs exact locked dependencies on first run.
Use Ctrl+C to shut down the development server cleanly.
"""
from pathlib import Path
import os
import shutil
import subprocess
import sys


def main():
    root = Path(__file__).resolve().parent
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm") or shutil.which("npm")
    if not npm:
        print("找不到 npm：请先安装 Node.js 20+，再运行本文件。")
        return 1
    if not (root / "node_modules" / ".bin" / ("vite.cmd" if os.name == "nt" else "vite")).exists():
        print("首次启动：正在安装已锁定的前端依赖……")
        result = subprocess.call([npm, "ci", "--no-audit", "--no-fund"], cwd=root)
        if result:
            return result
    print("深海魔鲸号 V28：请在浏览器打开 http://localhost:5206")
    print("鼠标单击游戏画面锁定环视；Esc 释放鼠标；Ctrl+C 关闭开发服务器。")
    try:
        return subprocess.call([npm, "run", "dev", "--", "--host", "0.0.0.0", "--port", "5206"], cwd=root)
    except KeyboardInterrupt:
        print("开发服务器已停止。")
        return 0


if __name__ == "__main__":
    sys.exit(main())
