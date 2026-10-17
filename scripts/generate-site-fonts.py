# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.67.0", "brotli==1.2.0"]
# ///
"""Generate bounded priority Latin faces; --check regenerates in memory only."""

import argparse
from hashlib import sha256
from io import BytesIO
from itertools import combinations
import json
from pathlib import Path
import re
import sys
import unicodedata

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = ROOT / "public/fonts"
META_DIR = ROOT / "src/app/fonts"
MANIFEST = META_DIR / "site-subsets.json"
CSS = META_DIR / "vietnamese.css"
SOURCES = (
    ("Inter", "inter-c9407645.woff2", "inter", [100, 900]),
    ("Space Grotesk", "space-grotesk-a0d054c4.woff2", "space-grotesk", [300, 700]),
)


def canonical_closure(points):
    """Include every canonical intermediate of each character, not only prefixes.

    For example, A + dot below + circumflex also needs A + circumflex (Â).
    Enumerating subsets is bounded by one character's canonical decomposition;
    multi-starter decompositions (such as Hangul) are kept whole.
    """
    result = set(points)
    for point in sorted(points):
        decomposed = unicodedata.normalize("NFD", chr(point))
        forms = [decomposed]
        if all(unicodedata.combining(mark) for mark in decomposed[1:]):
            marks = decomposed[1:]
            forms.extend(decomposed[0] + "".join(selected)
                         for count in range(len(marks) + 1)
                         for selected in combinations(marks, count))
        for form in forms:
            for normalization in ("NFC", "NFD"):
                result.update(map(ord, unicodedata.normalize(normalization, form)))
    return result


def repertoire():
    points = set(range(32, 127)) | {0xA0} | set(range(0x2000, 0x2070))
    for path in sorted((ROOT / "src").rglob("*")):
        if path.suffix in {".ts", ".tsx", ".json"} and path != MANIFEST:
            points.update(map(ord, path.read_text(encoding="utf-8")))
    # CSS text-transform can render case variants absent from literal DOM text.
    # Expand before canonical closure so those variants' intermediate forms
    # are also covered; do not perform compatibility normalization.
    for point in sorted(points):
        char = chr(point)
        for form in (char.upper(), char.lower(), char.title(), char.casefold()):
            points.update(map(ord, form))
    return canonical_closure(points)


def unicode_range(points):
    runs = []
    for point in sorted(points):
        if runs and point == runs[-1][1] + 1:
            runs[-1][1] = point
        else:
            runs.append([point, point])
    return ",".join(f"u+{lo:04x}" + (f"-{hi:04x}" if hi != lo else "") for lo, hi in runs)


def unicode_points(value):
    points = set()
    for item in value.split(","):
        item = item.strip().lower().removeprefix("u+")
        if "?" in item:
            low, high = item.replace("?", "0"), item.replace("?", "f")
        else:
            bounds = item.split("-")
            low, high = bounds[0], bounds[-1]
        points.update(range(int(low, 16), int(high, 16) + 1))
    return points


def xml(font, tag):
    out = BytesIO()
    font.saveXML(out, tables=[tag])
    return out.getvalue()


def feature_tags(font, tag):
    if tag not in font or not font[tag].table.FeatureList:
        return set()
    return {record.FeatureTag for record in font[tag].table.FeatureList.FeatureRecord}


def advance_deltas(font, glyph):
    """Canonical HVAR region coefficients, independent of subset index remapping."""
    table = font["HVAR"].table
    index = table.AdvWidthMap.mapping[glyph] if table.AdvWidthMap else font.getGlyphID(glyph)
    if index == 0xFFFFFFFF:
        return {}
    store = table.VarStore
    data = store.VarData[index >> 16]
    result = {}
    for region_index, delta in zip(data.VarRegionIndex, data.Item[index & 0xFFFF]):
        region = tuple((axis.StartCoord, axis.PeakCoord, axis.EndCoord)
                       for axis in store.VarRegionList.Region[region_index].VarRegionAxis)
        result[region] = result.get(region, 0) + delta
    return {region: delta for region, delta in result.items() if delta}


def verify_local(source, result, points):
    """Compare decoded glyphs/metrics and all retained variation data by glyph name.

    Layout closure is checked by regeneration with every feature enabled. This
    is structural proof, not a shaping-engine or browser pixel comparison.
    """
    assert set(result.getBestCmap()) == points, "subset cmap differs from repertoire"
    retained = set(result.getGlyphOrder())
    expected_aliases = {point: glyph for point, glyph in source.getBestCmap().items() if glyph in retained}
    assert result.getBestCmap() == expected_aliases, "source cmap aliases lost for retained glyphs (autohint classification)"
    for point, glyph in result.getBestCmap().items():
        assert source.getBestCmap()[point] == glyph, f"cmap changed: {point}"
    for tag in ("fvar", "avar", "STAT", "MVAR", "cvt ", "fpgm", "prep", "gasp"):
        assert (tag in source) == (tag in result), f"table presence changed: {tag}"
        if tag in source:
            assert xml(source, tag) == xml(result, tag), f"metrics/axes/hinting changed: {tag}"
    # OS/2 first/last character indices necessarily describe the smaller cmap.
    normalize_os2 = lambda font: re.sub(rb'<us(?:First|Last)CharIndex value="[^"]*"/>', b'', xml(font, "OS/2"))
    assert normalize_os2(source) == normalize_os2(result), "OS/2 metrics changed"
    for field in ("ascent", "descent", "lineGap", "caretSlopeRise", "caretSlopeRun", "caretOffset"):
        assert getattr(source["hhea"], field) == getattr(result["hhea"], field), f"hhea changed: {field}"
    assert source["head"].unitsPerEm == result["head"].unitsPerEm
    assert source["head"].created == result["head"].created
    assert source["head"].modified == result["head"].modified
    names = lambda font: sorted((n.nameID, n.platformID, n.platEncID, n.langID, n.toBytes()) for n in font["name"].names)
    assert names(source) == names(result), "name/copyright/license records changed"
    for tag in ("GSUB", "GPOS"):
        # Features with no applicable retained glyphs can disappear normally.
        assert feature_tags(result, tag) <= feature_tags(source, tag), f"unexpected feature tags: {tag}"
    for glyph in result.getGlyphOrder():
        assert glyph in source.getGlyphOrder(), f"unexpected glyph: {glyph}"
        assert source["hmtx"][glyph] == result["hmtx"][glyph], f"advance changed: {glyph}"
        # Decoding coordinates resolves composite references without comparing
        # renumbered glyph IDs or serialization details of WOFF2 transforms.
        left, right = source["glyf"][glyph], result["glyf"][glyph]
        assert left.getCoordinates(source["glyf"]) == right.getCoordinates(result["glyf"]), f"outline changed: {glyph}"
        if left.isComposite():
            assert [c.__dict__ for c in left.components] == [c.__dict__ for c in right.components], f"composite changed: {glyph}"
        if hasattr(left, "program"):
            assert left.program.getBytecode() == right.program.getBytecode(), f"hinting changed: {glyph}"
        if "gvar" in source:
            tuples = lambda font: [(v.axes, v.coordinates) for v in font["gvar"].variations.get(glyph, [])]
            assert tuples(source) == tuples(result), f"variation changed: {glyph}"
        if "HVAR" in source:
            assert "HVAR" in result
            assert advance_deltas(source, glyph) == advance_deltas(result, glyph), f"variable advance changed: {glyph}"
            # These source fonts encode side bearing deltas in gvar only.
            assert source["HVAR"].table.LsbMap is None and result["HVAR"].table.LsbMap is None
            assert source["HVAR"].table.RsbMap is None and result["HVAR"].table.RsbMap is None


def generate():
    requested = repertoire()
    originals = json.loads((META_DIR / "manifest.json").read_text(encoding="utf-8"))
    # Validate all ten originals before producing any output, including source hashes.
    for row in originals:
        data = (FONT_DIR / row["file"]).read_bytes()
        assert len(data) == row["bytes"] and sha256(data).hexdigest() == row["sha256"], f"original changed: {row['file']}"
    rows, assets = [], {}
    for family, filename, slug, weights in SOURCES:
        source = TTFont(FONT_DIR / filename, recalcTimestamp=False)
        font = TTFont(FONT_DIR / filename, recalcTimestamp=False)
        points = requested & set(source.getBestCmap())
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.layout_scripts = ["*"]
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        options.name_legacy = True
        options.glyph_names = True
        options.notdef_outline = True
        options.recalc_timestamp = False
        options.prune_unicode_ranges = False
        options.prune_codepage_ranges = False
        tool = subset.Subsetter(options=options)
        tool.populate(unicodes=points)
        tool.subset(font)
        # FreeType classifies glyphs through every Unicode cmap alias. Dropping
        # U+02BC while retaining its shared U+2019/quoteright outline changes
        # AF_NONBASE classification and shifts the hinted glyph at weight 500.
        # Restore aliases after shaping closure, without adding any outlines.
        retained = set(font.getGlyphOrder())
        for table in font["cmap"].tables:
            if table.isUnicode():
                original_table = next(t for t in source["cmap"].tables
                                      if (t.platformID, t.platEncID, t.format, t.language) ==
                                      (table.platformID, table.platEncID, table.format, table.language))
                table.cmap = {point: glyph for point, glyph in original_table.cmap.items() if glyph in retained}
        points = set(font.getBestCmap())
        advertised = set().union(*(unicode_points(r["unicodeRange"]) for r in originals if r["family"] == family))
        assert not points - advertised, f"cmap aliases outside original advertised coverage: {sorted(points - advertised)}"
        out = BytesIO()
        font.save(out)
        data = out.getvalue()
        verify_local(source, TTFont(BytesIO(data), recalcTimestamp=False), points)
        digest = sha256(data).hexdigest()
        target = f"{slug}-site-latin-{digest[:8]}.woff2"
        assets[FONT_DIR / target] = data
        rows.append(dict(family=family, file=target, sourceFile=filename,
                         sha256=digest, bytes=len(data), unicodeRange=unicode_range(points),
                         codepoints=sorted(points), weights=weights))
        print(f"{family}: {len(points)} codepoints; {len((FONT_DIR / filename).read_bytes())} -> {len(data)} bytes; local glyph/metrics/variation proof passed")
    assets[MANIFEST] = (json.dumps(rows, ensure_ascii=False, indent=2) + "\n").encode()
    css = CSS.read_bytes().decode("utf-8")
    newline = "\r\n" if "\r\n" in css else "\n"
    # Remove only our previous generated faces; preserve all other CSS verbatim.
    css = re.sub(r'@font-face\{[^}\r\n]*src:url\(/fonts/(?:inter|space-grotesk)-site-latin-[0-9a-f]{8}\.woff2\)[^}\r\n]*\}' + re.escape(newline * 2), "", css)
    for row in rows:
        own = [r for r in originals if r["family"] == row["family"]]
        original_latin = next(r for r in own if r["file"] == row["sourceFile"])
        # Always subtract from immutable original metadata, never a prior effective range.
        original_latin["effectiveUnicodeRange"] = unicode_range(
            unicode_points(original_latin["unicodeRange"]) - set(row["codepoints"]))
        latin_face = re.compile(r'(@font-face\{[^}]*src:url\(/fonts/' + re.escape(row["sourceFile"]) + r'\)[^}]*unicode-range:)[^}]+(?=\})')
        css, count = latin_face.subn(lambda match: match[1] + original_latin["effectiveUnicodeRange"], css)
        assert count == 1, f"missing/duplicate original Latin face: {row['family']}"
        vietnamese = next(r for r in own if "1ea0-1ef9" in r["unicodeRange"])
        anchor = re.search(r'@font-face\{[^}]*src:url\(/fonts/' + re.escape(vietnamese["file"]) + r'\)[^}]*\}', css)
        assert anchor, f"missing Vietnamese face: {row['family']}"
        latin = css.index(f"/fonts/{row['sourceFile']})")
        assert latin < anchor.start(), "original Latin must precede Vietnamese"
        face = (f"@font-face{{font-family:{row['family']};font-style:normal;"
                f"font-weight:{row['weights'][0]} {row['weights'][1]};font-display:optional;"
                f"src:url(/fonts/{row['file']}) format(\"woff2\");unicode-range:{row['unicodeRange']}}}")
        css = css[:anchor.start()] + face + newline * 2 + css[anchor.start():]
        before = set().union(*(unicode_points(r["unicodeRange"]) for r in own))
        after = set(row["codepoints"]).union(*(unicode_points(r.get("effectiveUnicodeRange", r["unicodeRange"])) for r in own))
        assert before == after, f"family coverage changed: {row['family']}"
    assets[META_DIR / "manifest.json"] = (json.dumps(originals, ensure_ascii=False, indent=2) + "\n").encode()
    assets[CSS] = css.encode("utf-8")
    return assets


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="compare regenerated bytes without writing")
    args = parser.parse_args()
    assets = generate()
    if args.check:
        stale = [str(path.relative_to(ROOT)) for path, data in assets.items() if not path.exists() or path.read_bytes() != data]
        # Reject unreferenced generated assets instead of silently leaving stale output.
        stale += [str(path.relative_to(ROOT)) for path in FONT_DIR.glob("*-site-latin-*.woff2") if path not in assets]
        if stale:
            print("Stale/missing site font output: " + ", ".join(stale), file=sys.stderr)
            return 1
        print("Verified 2 site subsets; assets, manifest and CSS match; no files written.")
    else:
        for path, data in assets.items():
            path.write_bytes(data)
        print("Generated 2 site subsets.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
