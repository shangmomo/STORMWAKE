"""Tidewater STORMWAKE V33-A desktop launcher.

Windows:      python start_v33.py
macOS/Linux:  python3 start_v33.py

Reuses the established Python/Vite launcher; no new shell dependency.
"""

from pathlib import Path
import runpy


if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).with_name("start_v29.py")), run_name="__main__")
