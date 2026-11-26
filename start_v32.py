"""Tidewater STORMWAKE V32: improved land combat and licensed rig slots.

Windows: python start_v32.py
macOS/Linux: python3 start_v32.py
The established V29 Python/Vite launcher is reused verbatim.
"""

from pathlib import Path
import runpy


if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).with_name("start_v29.py")), run_name="__main__")
