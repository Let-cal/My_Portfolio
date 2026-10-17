# Self-hosted Inter and Space Grotesk

The ten WOFF2 files listed in [manifest.json](manifest.json) are byte-for-byte copies of the subsets already emitted by `next/font/google` in this project on 2026-10-16. The manifest records each original emitted filename, Unicode range, byte length and SHA-256. No glyphs, outlines, variation axes, weights or hinting were edited. Public filenames include their content hash prefix.

Google's Latin Extended ranges overlap Vietnamese characters such as `Đ` and `ỹ`. Reordering alone did not prevent fallback requests in browser tests. The `effectiveUnicodeRange` entries therefore remove Vietnamese code points from the Latin Extended face, leaving them supplied by the original Vietnamese face. Tests prove that the union of advertised code points is unchanged. Greek, Cyrillic and the remaining Latin Extended characters stay available. The optional binary assets are unchanged. A separate Vietnamese-only family was also rejected after browser tests still downloaded the large files.

`font-display: optional`, normal style, original variable weights (Inter 100–900; Space Grotesk 300–700), and the existing Arial fallback metrics are preserved. The CSS supplies the same font variables used by the interface. Absolute asset URLs avoid relative paths changing when styles are inlined. No extra font preloads or runtime font service is introduced.

To update, obtain all matching subsets from the same upstream font release, preserve coverage and fallback metrics, update CSS and the manifest together, include the license notices, then run binary-integrity, three-locale browser and performance checks. Do not mix old and new font versions or discard characters to improve a benchmark.

## Bounded site Latin priority faces

`site-subsets.json` is a separate array of `{family, file, sourceFile, sha256,
bytes, unicodeRange, codepoints, weights}` rows. The two new content-hashed
WOFF2 files supplement the ten originals above. Each face uses its existing
family, style, variable weights and `font-display: optional`; it sits after
the original Latin face and before the original Vietnamese face. Vietnamese
therefore keeps priority for overlapping characters. Every original binary and
original Unicode-range metadata entry remains unchanged. The original Latin
faces advertise reduced effective ranges, with the removed points supplied by
the new site faces; the combined coverage still includes future Latin, Greek
and Cyrillic text. Font variables, fallback metrics and application
font stacks are unchanged.

Generate from the repository root with:

```sh
uv run scripts/generate-site-fonts.py
uv run scripts/generate-site-fonts.py --check
node --test tests/scripts/site-fonts.test.mjs tests/scripts/vietnamese-fonts.test.mjs
```

The uv script pins fontTools 4.67.0 and Brotli 1.2.0. It reads all `src` `.ts`,
`.tsx` and `.json` files in sorted order, excluding `site-subsets.json` itself.
The repertoire is their literal characters plus ASCII U+0020–007E, NBSP U+00A0
and U+2000–206F. Each character's uppercase, lowercase, titlecase and casefold
forms are added first, covering CSS `text-transform` output absent from literal
DOM text (for example, `ì` becomes `Ì` in uppercase navigation). Canonical
NFC/NFD forms and all subsets of each character's combining marks are then
included before intersecting each source Latin font's cmap. This includes
non-prefix intermediate compositions such as `Â` from `Ậ`. The sorted
`codepoints` and compact `unicodeRange` describe exactly the resulting cmap.
After shaping closure, every source cmap alias of each retained glyph is also
preserved, without adding outlines. This protects FreeType autohint
classification: Inter U+02BC and U+2019 share `quoteright`; dropping U+02BC
otherwise shifts U+2019 vertically by one pixel at weight 500 and 32px in the
local FreeType 2.13.2 reproduction. Added aliases are U+00D1, U+00F1, U+0131,
U+02BC for Inter and U+0131 for Space Grotesk. All lie inside the original
family's advertised coverage. Generation rejects aliases outside that coverage
instead of silently expanding it, and recomputes the remaining original Latin
range from immutable metadata.
This covers source text and common runtime/entity spacing; it is not an HTML
entity or JavaScript escape evaluator. Unanticipated runtime characters remain
available through the original faces and may request the larger original asset.

All layout features and scripts are selected (`layout_features=['*']` and
`layout_scripts=['*']`), with fontTools' GSUB shaping closure enabled. All
features applicable to the retained glyphs are kept. Inactive feature tags with
zero applicable glyphs are omitted by standard subsetting; no extra glyphs are
inserted solely to keep those tags. The original fonts remain the full fallback.
All name records, including OFL copyright/license notices, are
preserved; the license copyright lines declare no Reserved Font Name. No name
or copyright notices are rewritten. `.notdef` outlines and hinting are retained.

| Family | Source bytes | Site bytes | Cmap points |
| --- | ---: | ---: | ---: |
| Inter | 48,432 | 38,380 | 160 |
| Space Grotesk | 22,320 | 17,096 | 156 |

These save 15,276 bytes (21.6%) together versus the original Latin files.
The repertoire includes runtime punctuation, spacing, case variants, cmap aliases and canonical shaping
intermediates beyond the earlier 118-point prototype.
Size is measured on the files, not a browser transfer or performance benchmark.

Generation verifies all ten original hashes and sizes. A local Python proof
compares the exact cmap, retained decoded `glyf` coordinates and composites,
hinting, `hmtx`, `gvar`, canonical HVAR advance deltas, fvar/avar axes, STAT,
MVAR, line metrics and names against the source fonts. Output GSUB/GPOS feature
tags must be a subset of the source tags. A separate Node-driven Python check
compares glyph order and applicable feature tags against standard fontTools
subsetting with every feature/script selected, catching unnecessary support
glyphs while verifying the standard shaping closure and independently deriving
the exact expected alias cmap from the source. The core generator also asserts
that all source aliases for retained glyph names survive.
OS/2 first/last character indices and hhea metric counts may describe the
smaller font; glyph indices and layout lookup indices are remapped by fontTools.
Source timestamps are retained (`recalcTimestamp=False`), making regeneration
byte-stable under the pinned toolchain. `--check` regenerates in memory and
fails on stale/missing assets, manifest or CSS without writing any repository
files; the Node test also checks hashes and modification times remain unchanged.
If regeneration changes a hashed filename, remove the superseded generated
site asset after review; `--check` reports orphaned site assets rather than
silently deleting them.

The local proof is structural; it does not execute a shaping engine or establish
browser pixel/network equivalence. Main's separate browser proof covers default
rendering, variable weights and all advertised codepoints, alongside locale
rendering, runtime spacing and unexpected full-Latin requests. No performance
gates are changed by this generator.

An optional ignored local FreeType 2.13.2 proof compares every retained glyph's
bitmap, placement and advance at 32px across the original variable weight
minimum, 400, 500, 700 and maximum (deduplicated), in default, unhinted and
forced-autohint modes. Both updated assets match in every case. This is not
a Linux Chromium result; strict browser pixel checks remain required. FreeType
and HarfBuzz are not generator or CI dependencies.

## Original sources and notices

- [Inter in Google Fonts](https://github.com/google/fonts/tree/main/ofl/inter), [OFL notice](Inter-OFL.txt).
- [Space Grotesk in Google Fonts](https://github.com/google/fonts/tree/main/ofl/spacegrotesk), [OFL notice](SpaceGrotesk-OFL.txt).
