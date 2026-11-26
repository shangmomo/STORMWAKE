"""Download the CC0 Grab3D hydra once, with a bundled offline fallback.

Source: https://grab3d.com/models/creatures/hydra/
Licence: CC0 1.0 (creator's published asset licence).
Installer deliberately never overwrites a good local GLB, never uses a
private API, and leaves the existing leviathan.glb untouched if offline.
"""

from pathlib import Path
import os
import struct
import urllib.request

SOURCE = "https://grab3d.com/dl/hydra/hydra-light.glb"
MIN_BYTES = 100_000
MAX_BYTES = 75 * 1024 * 1024


def valid_glb(path):
    try:
        with path.open("rb") as handle:
            magic, version, length = struct.unpack("<4sII", handle.read(12))
        return magic == b"glTF" and version == 2 and MIN_BYTES <= length <= MAX_BYTES and path.stat().st_size == length
    except (OSError, ValueError, struct.error):
        return False


def ensure_hydra(root):
    destination = Path(root) / "public" / "models" / "titans" / "abyssal-hydra.glb"
    if valid_glb(destination):
        print("✅ 高清三首海魇模型已就绪。")
        return True
    temporary = destination.with_suffix(".download")
    destination.parent.mkdir(parents=True, exist_ok=True)
    print("首次获取高清 CC0 三首海魇模型（约 12MB）；断网时会自动使用本地备用巨兽。")
    try:
        request = urllib.request.Request(SOURCE, headers={"User-Agent": "Mozilla/5.0 Tidewater-AssetInstaller"})
        with urllib.request.urlopen(request, timeout=18) as response, temporary.open("wb") as output:
            total = 0
            while True:
                block = response.read(262144)
                if not block:
                    break
                total += len(block)
                if total > MAX_BYTES:
                    raise ValueError("model exceeds download limit")
                output.write(block)
        if not valid_glb(temporary):
            raise ValueError("download is not a complete binary glTF model")
        os.replace(temporary, destination)
        print("✅ 已安装高清三首海魇模型：", destination)
        return True
    except (OSError, ValueError, TimeoutError) as error:
        print("⚠ 高清模型暂不可下载，使用内置离线利维坦，游戏仍可正常运行：", error)
        return False
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    ensure_hydra(Path(__file__).resolve().parents[1])
