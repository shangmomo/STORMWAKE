"""Regenerate the offline outline payload used for the harbor's 3-D inscription.

Requires fonttools and a locally installed Noto Serif CJK Bold TTC.
The game itself does not need Python or fonts at runtime.
"""

import argparse
import json
from pathlib import Path

from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont


def sample_glyph(glyph_set, name):
    pen = RecordingPen()
    glyph_set[name].draw(pen)
    contours, current = [], []

    def close():
        nonlocal current
        points = []
        for x, y in current:
            p = (round(x), round(y))
            if not points or p != points[-1]:
                points.append(p)
        if len(points) > 2 and points[0] == points[-1]:
            points.pop()
        if len(points) >= 3:
            contours.append([n for xy in points for n in xy])
        current = []

    for op, args in pen.value:
        if op == "moveTo":
            if current:
                close()
            current.append(args[0])
        elif op == "lineTo":
            current.extend(args)
        elif op == "curveTo":
            assert len(args) % 3 == 0, (op, args)
            for i in range(0, len(args), 3):
                start = current[-1]
                p1, p2, end = args[i : i + 3]
                # Four stations capture small wood-carved bevels without
                # filling the game with thousands of unnecessary vertices.
                for j in range(1, 5):
                    t = j / 4
                    u = 1 - t
                    current.append((
                        u**3 * start[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * end[0],
                        u**3 * start[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * end[1],
                    ))
        elif op in ("closePath", "endPath"):
            close()
        else:
            raise ValueError(f"Unexpected pen command: {op}")

    if current:
        close()
    return contours


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--font", default="/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc")
    parser.add_argument("--out", default="src/world/village/HarborGlyphContours.js")
    args = parser.parse_args()

    font = TTFont(args.font, fontNumber=0)
    cmap, glyph_set = font.getBestCmap(), font.getGlyphSet()
    chars = "潮汐港"
    contours = [sample_glyph(glyph_set, cmap[ord(ch)]) for ch in chars]
    payload = json.dumps(contours, ensure_ascii=False, separators=(",", ":"))
    text = (
        "// Generated from Noto Serif CJK Bold under SIL OFL 1.1.\n"
        "// Do not edit by hand; see tools/harbor/generate_letter_contours.py.\n"
        f"// Glyph sequence: {chars}; font units per em: {font['head'].unitsPerEm}.\n"
        f"export const HARBOR_GLYPH_CONTOURS = {payload};\n"
    )
    target = Path(args.out)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")
    print(f"Generated {len(text)} bytes of contours with {[len(x) for x in contours]} paths")


if __name__ == "__main__":
    main()
