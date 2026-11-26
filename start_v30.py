"""Tidewater V30 船舶驾驶版 Windows/macOS/Linux 启动入口。

Windows: python start_v30.py
macOS/Linux: python3 start_v30.py

项目内保留原 Python 自动安装与 Vite 本地启动器，以减少重复维护。
"""

from pathlib import Path
import runpy


if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).with_name("start_v29.py")), run_name="__main__")
