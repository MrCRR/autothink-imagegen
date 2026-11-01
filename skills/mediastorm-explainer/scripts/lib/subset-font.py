#!/usr/bin/env python3
"""Clamp + subset the Noto Sans SC variable font, and emit its coverage map.

Called by setup-fonts.mjs; not meant to be run by hand.

    python3 subset-font.py <src.ttf> <chars.txt> <out.woff2> <out-coverage.json>
"""

import json
import os
import sys
import tempfile

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


def main() -> int:
    src, chars_file, out_woff2, out_coverage = sys.argv[1:5]

    text = open(chars_file, encoding="utf-8").read()

    # Clamp the weight axis, then reopen: instancing in place leaves stale gvar
    # entries that break the subsetter's save.
    font = TTFont(src)
    if "fvar" in font:
        clamped = instantiateVariableFont(font, {"wght": (400, 900)}, inplace=True, updateFontNames=False)
        handle, temp_path = tempfile.mkstemp(suffix=".ttf")
        os.close(handle)
        try:
            clamped.save(temp_path)
            font = TTFont(temp_path)
        finally:
            os.unlink(temp_path)

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["kern", "liga"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(out_woff2)

    # Coverage straight from the written font, so a glyph the source lacks is reported.
    written = TTFont(out_woff2)
    codepoints = sorted(written.getBestCmap().keys())
    ranges = []
    start = prev = codepoints[0]
    for cp in codepoints[1:]:
        if cp == prev + 1:
            prev = cp
            continue
        ranges.append([start, prev])
        start = prev = cp
    ranges.append([start, prev])

    json.dump(
        {
            "family": "Noto Sans SC",
            "source": "Noto Sans SC variable (SIL OFL 1.1)",
            "charset": f"{len(text)} requested characters",
            "ranges": ranges,
        },
        open(out_coverage, "w", encoding="utf-8"),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
