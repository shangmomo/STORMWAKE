"""Install individually licensed, animated land GLBs. Python 3, no shell scripts.

Usage from the project root on a PC with normal internet access:
    python tools/install_land_assets_v32.py --download-open
    python tools/install_land_assets_v32.py --audit
    python tools/install_land_assets_v32.py --import-glb warden C:/Downloads/warden.glb \
        --license CC-BY-4.0 --attribution "Artist, title, source URL"

Nothing in this command modifies the original V30 maritime assets or keymap.
The CC0 KayKit pack is deliberately offered as a *rigging test baseline*;
the final character art should be selected for consistent visual direction.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import struct
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "models" / "land"
MANIFEST = DEST / "manifest.json"
KAYKIT_REPO = "https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0"
KAYKIT_CDN = (
    "https://cdn.jsdelivr.net/gh/KayKit-Game-Assets/"
    "KayKit-Character-Pack-Adventures-1.0/addons/"
    "kaykit_character_pack_adventures/Characters/gltf/"
)
FOX_URL = (
    "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/"
    "Models/Fox/glTF-Binary/Fox.glb"
)
SLOTS = {
    "captain", "resident_harbor", "resident_herbalist", "resident_keeper",
    "resident_netmaker", "resident_merchant", "resident_fisher",
    "resident_baker", "resident_scout", "resident_medic", "resident_sailor",
    "resident_carpenter", "resident_shipwright", "resident_cartographer",
    "resident_watchman", "resident_teacher", "resident_courier",
    "resident_gardener", "resident_smith", "resident_apprentice",
    "resident_bellringer",
    "warden", "hound", "crab", "wraith", "fox", "deer", "boar",
}
OPEN_ASSETS = {
    "captain": ("Knight.glb", "CC0", KAYKIT_REPO, 1.0),
    "resident_harbor": ("Rogue.glb", "CC0", KAYKIT_REPO, 1.0),
    "resident_herbalist": ("Mage.glb", "CC0", KAYKIT_REPO, 1.0),
    "resident_keeper": ("Barbarian.glb", "CC0", KAYKIT_REPO, 1.0),
    "warden": ("Rogue_Hooded.glb", "CC0", KAYKIT_REPO, 2.0),
}


def read_glb(path: pathlib.Path) -> dict:
    """Strict metadata check: no external textures, Draco or meshopt for the custom WebGPU engine."""
    raw = path.read_bytes()
    if len(raw) < 20 or raw[:4] != b"glTF":
        raise ValueError(f"{path.name}: not a GLB file")
    version, length = struct.unpack_from("<II", raw, 4)
    if version != 2 or length != len(raw):
        raise ValueError(f"{path.name}: invalid glTF 2.0 length/version")
    chunk_length, chunk_type = struct.unpack_from("<II", raw, 12)
    if chunk_type != 0x4E4F534A or 20 + chunk_length > len(raw):
        raise ValueError(f"{path.name}: missing JSON chunk")
    data = json.loads(raw[20:20 + chunk_length].decode("utf-8"))
    if data.get("extensionsRequired"):
        raise ValueError(f"{path.name}: unsupported extensions {data['extensionsRequired']}")
    if any("uri" in image for image in data.get("images", [])):
        raise ValueError(f"{path.name}: external images; export with embedded textures")
    if not data.get("skins") or not data.get("animations"):
        raise ValueError(f"{path.name}: the model requires a skin AND authored clips")
    names = [animation.get("name", f"clip_{i}") for i, animation in enumerate(data["animations"])]
    nodes = data.get("nodes", [])
    verts = sum(a.get("count", 0) for a in data.get("accessors", []) if a.get("type") == "VEC3")
    if len(nodes) > 1024 or len(data["animations"]) > 512 or len(raw) > 90 * 1024 * 1024:
        raise ValueError(f"{path.name}: above safety/performance budget")
    return {"bytes": len(raw), "bones": max(len(s.get("joints", [])) for s in data["skins"]),
            "clips": names, "nodes": len(nodes), "vec3_accessors_total": verts}


def load_manifest() -> dict:
    if not MANIFEST.exists():
        return {"schema": 1, "actors": {}}
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if not isinstance(manifest.get("actors"), dict):
        raise ValueError("Invalid asset manifest")
    return manifest


def save_manifest(manifest: dict) -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def install(slot: str, path: pathlib.Path, license_id: str, attribution: str, scale: float = 1) -> dict:
    if slot not in SLOTS:
        raise ValueError(f"Invalid slot {slot}; allowed: {', '.join(sorted(SLOTS))}")
    if license_id not in {"CC0", "CC-BY-4.0", "MIT"}:
        raise ValueError("Only reviewed, redistributable licenses are accepted")
    if not 0.001 <= scale <= 30:
        raise ValueError("Scale must be between 0.001 and 30")
    if license_id != "CC0" and not attribution.strip():
        raise ValueError("Attribution is required for CC-BY and MIT assets")
    info = read_glb(path)
    DEST.mkdir(parents=True, exist_ok=True)
    filename = f"{slot}.glb"
    target = DEST / filename
    if path.resolve() != target.resolve():
        shutil.copy2(path, target)
    manifest = load_manifest()
    manifest["actors"][slot] = {"file": filename, "license": license_id,
                                "attribution": attribution, "scale": scale, "clips": info["clips"]}
    save_manifest(manifest)
    return info


def fetch_glb(url: str, filename: str) -> pathlib.Path:
    # Explicit allowlist; URLs are built from audited upstream sources only.
    if not (url.startswith(KAYKIT_CDN) or url == FOX_URL):
        raise ValueError("Unapproved download host")
    import tempfile
    out = pathlib.Path(tempfile.mkdtemp(prefix="tidewater-assets-")) / filename
    request = urllib.request.Request(url, headers={"User-Agent": "Tidewater-AssetInstaller/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response, out.open("wb") as f:
        shutil.copyfileobj(response, f)
    return out


def download_open() -> None:
    for slot, (filename, license_id, source, scale) in OPEN_ASSETS.items():
        print(f"Downloading {slot}: {filename} …")
        try:
            path = fetch_glb(KAYKIT_CDN + filename, filename)
            info = install(slot, path, license_id, f"Kay Lousberg, KayKit Adventurers, {source}", scale)
            print(f"  OK {info['bones']} bones, {len(info['clips'])} clips")
        except Exception as error:
            print(f"  SKIP: {error}; install a verified single-file GLB manually")
    print("Downloading Khronos animated Fox …")
    try:
        info = install("fox", fetch_glb(FOX_URL, "Fox.glb"), "CC-BY-4.0",
                       "Fox by PixelMannen and contributors; Khronos glTF Sample Assets, "
                       "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox", scale=.008)
        print(f"  OK {info['bones']} bones, {len(info['clips'])} clips")
    except Exception as error:
        print(f"  SKIP: {error}; install a verified single-file GLB manually")


def audit() -> bool:
    manifest = load_manifest()
    if not manifest["actors"]:
        print("No optional GLBs installed. Built-in Rocketbox residents and V32 lighthouse remain usable.")
        return False
    good = True
    for slot, entry in sorted(manifest["actors"].items()):
        try:
            info = read_glb(DEST / entry["file"])
            lower = [clip.lower() for clip in info["clips"]]
            aliases = {"idle": ("idle", "survey", "rest"), "walk": ("walk",),
                       "run": ("run", "gallop", "fast_flying"),
                       "attack": ("attack", "punch", "headbutt"),
                       "hit": ("hit", "hurt", "damage"), "death": ("death", "die")}
            coverage = {action: any(
                keyword in clip for clip in lower for keyword in aliases[action]
            )
                        for action in ("idle", "walk", "run", "attack", "hit", "death")}
            print(f"{slot:20s} {info['bones']:3d} bones | {len(lower):3d} clips | {info['bytes']/1048576:.1f} MiB | {coverage}")
            if not coverage["idle"]: good = False
        except Exception as error:
            good = False
            print(f"{slot}: FAIL {error}")
    return good


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--download-open", action="store_true", help="Download CC0 characters and animated CC-BY fox")
    group.add_argument("--audit", action="store_true", help="Audit every installed actor and all animation names")
    group.add_argument("--import-glb", nargs=2, metavar=("SLOT", "FILE"))
    parser.add_argument("--license", choices=["CC0", "CC-BY-4.0", "MIT"])
    parser.add_argument("--attribution", default="")
    parser.add_argument("--scale", type=float, default=1.0)
    args = parser.parse_args()
    if args.download_open:
        download_open()
        audit()
    elif args.audit:
        raise SystemExit(0 if audit() else 1)
    else:
        if not args.license:
            parser.error("--import-glb requires --license")
        result = install(args.import_glb[0], pathlib.Path(args.import_glb[1]),
                         args.license, args.attribution, args.scale)
        print(f"Installed {args.import_glb[0]} with {len(result['clips'])} clips")


if __name__ == "__main__":
    main()
