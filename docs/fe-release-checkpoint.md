# Frontend release checkpoint — 2026-10-16

Status: **performance gate open; not released**. This is local production-build evidence, not a claim that GitHub CI or Vercel production has passed.

## Verified

- Production build and TypeScript pass on Node 22.23.2 / Windows.
- 809 unit tests, 48 Chromium browser tests, and 24 asset/script tests pass. ESLint passes.
- Browser regressions cover Skills hover/wheel stability, bounded moving card backdrops, chapter seals, mobile hash navigation, external SVG glyphs and printing.
- Initial home JavaScript: 196.7 KB gzip on EN/JA/VI; limit 200 KB. The quick view is 176.3 KB.
- Production dependency audit: zero vulnerabilities. Development tooling still has upstream braces advisories; the production audit is not suppressed.
- CI configuration passes actionlint 1.7.12 and Bash syntax checks. Independent review found no concrete integration blocker. Linux jobs have not yet run on GitHub.

## Mobile performance

Lighthouse 13.5.0, production server on localhost:3100, installed Google Chrome on Windows, default mobile simulation, three runs per locale. Values below are independent medians. The final VI set was repeated without concurrent browser tests.

| Locale | Performance | Accessibility | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| EN | 80 | 100 | 4484 ms | 166 ms | 0 |
| JA | 80 | 100 | 4332 ms | 213 ms | 0 |
| VI | 73 | 100 | 5237 ms | 180 ms | 0 |
| Required | ≥85 | ≥95 | ≤2500 ms | ≤200 ms | ≤0.1 |

All locales still fail Performance and LCP; JA also fails TBT. Do not merge or declare the FE complete from these results. These lab measurements do not establish field INP or physical mobile GPU performance. Earlier Lighthouse 12 measurements use a different engine version and are not directly equivalent.

## Changes covered

Responsive AVIF portraits preserve the approved artwork. A shared external SVG sprite preserves skill glyphs. Desktop scene inputs load with the live canvas; static backgrounds use a small chapter observer. Offscreen mobile rendering is contained, with exact native anchor navigation and print behavior retained. Geometry starts near visibility, and hidden mobile Hero leader lines no longer trigger geometry reads. Reused internationalization formatters avoid repeated setup. Inline CSS removes blocking stylesheet requests, with the documented tradeoff of duplicated HTML/RSC CSS and no independent stylesheet cache.

The original input portrait is outside the served public directory and preserved locally. This does not erase it from existing Git history.

## Next release gates

1. Resolve the remaining LCP/Performance failures and JA blocking time while preserving the approved design.
2. Repeat the full verification on the final revision and review the diff.
3. Push the branch, open a PR, run required GitHub checks and configure branch protection.
4. Merge only after required checks pass, then verify Vercel's revision, free hosting arrangement and public domains.

See [CI and release procedure](ci-release.md). Backend/admin work follows the frontend release.
