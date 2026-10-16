# Self-hosted Inter and Space Grotesk

The ten WOFF2 files listed in [manifest.json](manifest.json) are byte-for-byte copies of the subsets already emitted by `next/font/google` in this project on 2026-10-16. The manifest records each original emitted filename, Unicode range, byte length and SHA-256. No glyphs, outlines, variation axes, weights or hinting were edited. Public filenames include their content hash prefix.

Google's Latin Extended ranges overlap Vietnamese characters such as `Đ` and `ỹ`. Reordering alone did not prevent fallback requests in browser tests. The `effectiveUnicodeRange` entries therefore remove Vietnamese code points from the Latin Extended face, leaving them supplied by the original Vietnamese face. Tests prove that the union of advertised code points is unchanged. Greek, Cyrillic and the remaining Latin Extended characters stay available. The optional binary assets are unchanged. A separate Vietnamese-only family was also rejected after browser tests still downloaded the large files.

`font-display: optional`, normal style, original variable weights (Inter 100–900; Space Grotesk 300–700), and the existing Arial fallback metrics are preserved. The CSS supplies the same font variables used by the interface. Absolute asset URLs avoid relative paths changing when styles are inlined. No extra font preloads or runtime font service is introduced.

To update, obtain all matching subsets from the same upstream font release, preserve coverage and fallback metrics, update CSS and the manifest together, include the license notices, then run binary-integrity, three-locale browser and performance checks. Do not mix old and new font versions or discard characters to improve a benchmark.

## Sources and notices

- [Inter in Google Fonts](https://github.com/google/fonts/tree/main/ofl/inter), [OFL notice](Inter-OFL.txt).
- [Space Grotesk in Google Fonts](https://github.com/google/fonts/tree/main/ofl/spacegrotesk), [OFL notice](SpaceGrotesk-OFL.txt).
