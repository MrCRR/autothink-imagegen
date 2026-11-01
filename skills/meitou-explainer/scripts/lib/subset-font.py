#!/usr/bin/env python3
"""Subset one CJK font and emit its coverage map.

    python3 subset-font.py <src.ttf> <chars.txt> <out.woff2> <out-coverage.json> [--clamp-weights]

--clamp-weights narrows a variable font to 400-900 (we never use lighter weights).
"""

import json
import os
import sys
import tempfile

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


def load(src: str, clamp: bool) -> TTFont:
    font = TTFont(src)
    if not clamp or "fvar" not in font:
        return font
    # Instancing in place leaves stale gvar entries that break the subsetter's
    # save, so round-trip through a temp file.
    instanced = instantiateVariableFont(font, {"wght": (400, 900)}, inplace=True, updateFontNames=False)
    handle, temp_path = tempfile.mkstemp(suffix=".ttf")
    os.close(handle)
    try:
        instanced.save(temp_path)
        return TTFont(temp_path)
    finally:
        os.unlink(temp_path)


def coverage(font: TTFont) -> dict:
    codepoints = sorted(font.getBestCmap().keys())
    ranges = []
    start = prev = codepoints[0]
    for cp in codepoints[1:]:
        if cp == prev + 1:
            prev = cp
            continue
        ranges.append([start, prev])
        start = prev = cp
    ranges.append([start, prev])
    return {"ranges": ranges}


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    clamp = "--clamp-weights" in sys.argv
    src, chars_file, out_font, out_coverage = args[:4]

    text = open(chars_file, encoding="utf-8").read()
    font = load(src, clamp)

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["kern", "liga"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(out_font)

    written = TTFont(out_font)
    data = coverage(written)
    data["charset"] = f"{len(text)} requested characters"
    data["family"] = written["name"].getDebugName(1) or os.path.basename(src)
    data["source"] = "SIL Open Font License 1.1"
    json.dump(data, open(out_coverage, "w", encoding="utf-8"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
