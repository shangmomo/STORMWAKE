"""启动 Tidewater V31。需要 Python 3、Node.js 20+ 和支持 WebGPU 的浏览器。

Windows: 双击或执行 python start_v29.py
macOS/Linux: python3 start_v29.py
Ctrl+C 关闭本地服务器；游戏不上传到外部服务器。
"""

from pathlib import Path
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser


def main():
    root = Path(__file__).resolve().parent
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm") or shutil.which("npm")
    if not npm:
        print("未检测到 npm。请先安装 Node.js 20 或更新版本。")
        return 1

    vite_binary = root / "node_modules" / ".bin" / ("vite.cmd" if os.name == "nt" else "vite")
    if not vite_binary.exists():
        print("首次运行：正在安装项目所需依赖……")
        if subprocess.call([npm, "ci", "--no-audit", "--no-fund"], cwd=root):
            print("依赖安装失败。请检查网络与 Node.js 版本。")
            return 1

    url = "http://127.0.0.1:5206/"
    print("Tidewater V31 · 翡翠密林、灯塔下的低语与陆地潮蚀冒险")
    print("陆地：前往出生点附近告示板，E 接任务 / 机关互动；小汐陪同探索。")
    print("Z 拔出短刃；J/左键轻击，K 重击，Q 闪避，右键格挡，P 展开/折叠冒险日志。")
    print("密林路标通往断崖灯塔；夜间潮蚀怪物可能入侵港口。")
    print("W/S 调整并保持车钟油门；A/D 控制自动回中的船舵。")
    print("鼠标始终只转镜头，不影响船头；N 停车，Shift 急速。")
    print("Space 上浮 / Ctrl 下潜 / B 应急上浮 / H 切换即时推进。")
    print("右上角显示目标航速、实际航速、油门档位、方向舵。")
    print(f"正在启动：{url}")
    try:
        server = subprocess.Popen(
            [npm, "run", "dev", "--", "--host", "127.0.0.1", "--port", "5206", "--strictPort"],
            cwd=root,
        )
    except OSError as error:
        print(f"服务启动失败：{error}")
        return 1

    try:
        for _ in range(70):
            if server.poll() is not None:
                print("开发服务提前退出，通常是 5206 端口占用。")
                return server.returncode
            try:
                with urllib.request.urlopen(url, timeout=0.6):
                    webbrowser.open(url)
                    print("已尝试打开浏览器；若未弹出，请手动访问：", url)
                    print("按 Ctrl+C 可关闭游戏服务。")
                    return server.wait()
            except (urllib.error.URLError, TimeoutError, OSError):
                time.sleep(0.25)
        print("服务启动超时。请检查 5206 端口是否被占用。")
        return 1
    except KeyboardInterrupt:
        print("\n正在结束游戏服务……")
        return 0
    finally:
        if server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=4)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()


if __name__ == "__main__":
    sys.exit(main())
