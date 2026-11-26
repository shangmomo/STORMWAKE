"""Tidewater V31 陆地生态与灯塔冒险，Windows/macOS/Linux 通用启动入口。

Windows: python start_v31.py
macOS/Linux: python3 start_v31.py

沿用工程中经过验证的 Python npm/Vite 启动器，无须下载任何额外游戏模型。
"""

from pathlib import Path
import runpy


if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).with_name("start_v29.py")), run_name="__main__")
