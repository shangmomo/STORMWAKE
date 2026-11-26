"""Per-character asset and per-motion acceptance report (Python 3).

    python tools/audit_land_v33.py
    python tools/audit_land_v33.py --strict

Exit zero by default if the bundled baseline is structurally valid. --strict
fails until EVERY art slot has a reviewed rig and its required authored clips.
This prevents placeholder/procedural animation from being called AAA-ready.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from install_land_assets_v32 import DEST, MANIFEST, load_manifest, read_glb

ROOT = Path(__file__).resolve().parents[1]
CHARACTER_DIR = ROOT / "public" / "models" / "characters"

ROLES = {
    "captain": ("joe.glb", ("idle", "walk", "run", "attack", "hit", "death")),
    "resident_harbor": ("joe.glb", ("idle", "walk", "talk")),
    "resident_herbalist": ("marta.glb", ("idle", "walk", "talk")),
    "resident_keeper": ("joe.glb", ("idle", "walk", "talk")),
    "resident_netmaker": ("marta.glb", ("idle", "walk", "talk")),
    "resident_merchant": ("joe.glb", ("idle", "walk", "talk")),
    "resident_fisher": ("marta.glb", ("idle", "walk", "talk")),
    "resident_baker": ("joe.glb", ("idle", "walk", "talk")),
    "resident_scout": ("marta.glb", ("idle", "walk", "talk")),
    "resident_medic": ("joe.glb", ("idle", "walk", "talk")),
    "resident_sailor": ("marta.glb", ("idle", "walk", "talk")),
    "resident_carpenter": ("joe.glb", ("idle", "walk", "talk")),
    "resident_shipwright": ("marta.glb", ("idle", "walk", "talk")),
    "resident_cartographer": ("joe.glb", ("idle", "walk", "talk")),
    "resident_watchman": ("marta.glb", ("idle", "walk", "talk")),
    "resident_teacher": ("joe.glb", ("idle", "walk", "talk")),
    "resident_courier": ("marta.glb", ("idle", "walk", "talk")),
    "resident_gardener": ("joe.glb", ("idle", "walk", "talk")),
    "resident_smith": ("marta.glb", ("idle", "walk", "talk")),
    "resident_apprentice": ("joe.glb", ("idle", "walk", "talk")),
    "resident_bellringer": ("marta.glb", ("idle", "walk", "talk")),
    "warden": (None, ("idle", "walk", "attack", "hit", "death")),
    "hound": (None, ("idle", "walk", "attack", "hit", "death")),
    "crab": (None, ("idle", "walk", "attack", "hit", "death")),
    "wraith": (None, ("idle", "run", "attack", "hit", "death")),
    "fox": (None, ("idle", "walk", "run")),
    "deer": (None, ("idle", "walk", "run")),
    "boar": (None, ("idle", "walk", "run")),
}

KEYWORDS = {
    "idle": ("idle", "rest", "survey"),
    "walk": ("walk", "locomotion"),
    "run": ("run", "gallop", "fast_flying", "jog", "sprint"),
    "attack": ("attack", "punch", "headbutt", "swing", "slash"),
    "hit": ("hit", "hurt", "damage"),
    "death": ("death", "die"),
    "talk": ("talk", "gestic"),
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="Require real individual rigs and authored motions for every role")
    args = parser.parse_args()
    manifest = load_manifest().get("actors", {})
    invalid, unfinished = 0, 0
    cached = {}
    print("Role                 Mesh / origin       Bones  Animation acceptance")
    print("-" * 108)
    for role, (builtin, required) in ROLES.items():
        entry = manifest.get(role)
        if entry:
            filename = entry.get("file", "")
            path = (CHARACTER_DIR if entry.get('collection') == 'characters' else DEST) / filename
            source = f"{filename} [reviewed:{entry.get('license', '?')}]"
            if entry.get("license") not in ("MIT", "CC0", "CC-BY-4.0") or (
                entry.get("license") != "CC0" and not entry.get("attribution")
            ):
                invalid += 1
                print(f"{role:20s} INVALID LICENSE / ATTRIBUTION")
                continue
        elif builtin:
            path = CHARACTER_DIR / builtin
            source = f"{builtin} [MIT fallback]"
        else:
            path = None
            source = "uninstalled [procedural]"
        info = None
        if path is not None:
            try:
                if path not in cached:
                    cached[path] = read_glb(path)
                info = cached[path]
            except Exception as exc:
                invalid += 1
                print(f"{role:20s} INVALID GLB: {exc}")
                continue
        names = [n.lower() for n in info["clips"]] if info else []
        statuses = []
        for motion in required:
            authored = any(any(term in clip for term in KEYWORDS[motion]) for clip in names)
            statuses.append(f"{motion}:{'A' if authored else 'F' if builtin and motion in ('walk','run','attack','hit','death') else '-'}")
            if not authored:
                unfinished += 1
        if entry is None:
            unfinished += 1  # every intended role needs an individual approved GLB
        bone_count = str(info["bones"]) if info else "0"
        print(f"{role:20s} {source[:28]:28s} {bone_count:>4s}   {' '.join(statuses)}")
    print(f"\nInvalid source/rig: {invalid} | Not-yet-authored role/motion items: {unfinished}")
    print("A=authored animation clip, F=procedural fallback (NOT fully accepted), -=missing")
    if invalid:
        return 2
    if args.strict and unfinished:
        print("STRICT QUALITY GATE: NOT PASSED. Keep pending assets out of release claims.")
        return 1
    print("Structural baseline checked; this is NOT a final art or visual-QA approval.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
