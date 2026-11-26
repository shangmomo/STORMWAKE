"""Tidewater STORMWAKE V34 desktop launcher.

Windows: python start_v34.py
macOS/Linux: python3 start_v34.py

Runs the established local launcher without requiring a shell script.
"""

from pathlib import Path
import runpy


if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).with_name("start_v29.py")), run_name="__main__")
