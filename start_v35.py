"""Start the full Tidewater STORMWAKE V35 WebGPU project.

Windows: python start_v35.py
macOS / Linux: python3 start_v35.py
"""

from pathlib import Path
import runpy


if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).with_name("start_v29.py")), run_name="__main__")
