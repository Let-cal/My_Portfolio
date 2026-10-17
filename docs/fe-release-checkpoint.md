# Frontend release checkpoint — 2026-10-17

Status: **performance gate open; not released**. Candidate commit `40f4813` is on [PR #1](https://github.com/Let-cal/My_Portfolio/pull/1). A ready preview is not a production release.

## Verified

- Production build and TypeScript pass on Node 22.23.2 / Windows.
- 829 unit tests, 52 Chromium browser tests, and 36 asset/script tests pass locally. ESLint passes.
- Browser regressions cover Skills hover/wheel stability, bounded moving card backdrops, chapter seals, mobile hash navigation, external SVG glyphs and printing.
- Initial home JavaScript: 196.7 KB gzip on EN/JA/VI; limit 200 KB. The quick view is 176.3 KB.
- Production dependency audit: zero vulnerabilities. Development tooling still has upstream braces advisories; the production audit is not suppressed.
- CI configuration passes actionlint 1.7.12. Linux quality, full Chromium browser suite, production audit, full-history secret scan and read-only CodeQL checks pass on this candidate; Vercel preview is ready. Independent review of the recent font/Intl changes reported one font concern; an actual-browser regression disproved it because Tailwind expands the inline theme token to the correct font stack. Final whole-branch review is still required before release.

## Mobile performance

Lighthouse 13.5.0, production server on localhost:3100, Linux Chromium in the isolated GitHub Actions performance job, default mobile simulation, three runs per locale. Values below are independent medians from [run 38938885321](https://github.com/Let-cal/My_Portfolio/actions/runs/38938885321), commit `40f4813`.

| Locale | Performance | Accessibility | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| EN | 88 | 100 | 3467 ms | 142 ms | 0.00138 |
| JA | 88 | 100 | 3541 ms | 124 ms | 0.00138 |
| VI | 88 | 100 | 3320 ms | 150 ms | 0.00138 |
| Required | ≥85 | ≥95 | ≤2500 ms | ≤200 ms | ≤0.1 |

All locales now pass Performance, Accessibility, TBT and CLS. LCP remains the only failed metric for all three locales. Do not merge or declare the FE complete from these results. These lab measurements do not establish field INP or physical mobile GPU performance. Windows results and earlier Lighthouse 12 measurements are not directly equivalent to this runner.

## Changes covered

Responsive AVIF portraits preserve the approved artwork. A shared external SVG sprite preserves skill glyphs. Desktop scene inputs load with the live canvas; static backgrounds use a small chapter observer. Offscreen mobile rendering is contained, with exact native anchor navigation and print behavior retained. Geometry starts near visibility, and hidden mobile Hero leader lines no longer trigger geometry reads. Reused internationalization formatters avoid repeated setup. Inline CSS removes blocking stylesheet requests, with the documented tradeoff of duplicated HTML/RSC CSS and no independent stylesheet cache.

The original input portrait is outside the served public directory and preserved locally. This does not erase it from existing Git history.

## Next release gates

1. Resolve the remaining LCP, Performance and blocking-time failures while preserving the approved design.
2. Repeat the full verification on the final revision and review the diff.
3. Run all required GitHub checks on the final PR revision. The branch is pushed, PR #1 is open, and strict protection on `main` includes the mobile performance gate.
4. Merge only after required checks pass, then verify Vercel's revision, free hosting arrangement and public domains.

See [CI and release procedure](ci-release.md). Backend/admin work follows the frontend release.

## Current optimization under verification

Server-prepared final ticker text removes initial Intl.NumberFormat construction from the page hydration path. Count-up still initializes on visibility with the original easing, duration, grouping and accessibility labels. Local build, lint and TypeScript pass; 828 unit tests and a further visibility regression pass, 52 Chromium tests pass, and 36 script/asset checks pass. Initial home JavaScript is 196.7 KB gzip. Windows mobile EN medians remain below the release requirement (Performance 73, LCP 4557 ms, TBT 378 ms, Accessibility 100, CLS 0); this is not evidence that the performance gate is resolved.

Controlled internal class branches now use clsx where exact-output parity tests prove conflict resolution is unnecessary; caller overrides and conflicting utilities retain twMerge. This reduces repeated work without claiming that the shared merger initialization has been removed. Tailwind source discovery is explicitly scoped to src; this is a deterministic build safeguard and saved only 65 raw CSS bytes in the measured build.
