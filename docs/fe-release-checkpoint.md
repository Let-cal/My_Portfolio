# Frontend release checkpoint — 2026-10-17

Status: **performance gate open; not released**. Candidate commit `39b628a` is on [PR #1](https://github.com/Let-cal/My_Portfolio/pull/1). A ready preview is not a production release.

## Verified

- Production build and TypeScript pass on Node 22.23.2 / Windows.
- 844 unit tests, 58 Chromium browser tests, and 43 asset/script tests pass locally. ESLint passes.
- Browser regressions cover Skills hover/wheel stability, bounded moving card backdrops, chapter seals, mobile hash navigation, external SVG glyphs and printing.
- Initial home JavaScript: 196.8 KB gzip on EN/JA/VI; limit 200 KB. The quick view is 176.3 KB.
- Production dependency audit: zero vulnerabilities. Development tooling still has upstream braces advisories; the production audit is not suppressed.
- CI configuration passes actionlint 1.7.12. Linux quality, production audit, full-history secret scan and read-only CodeQL checks pass on this candidate; its browser job finished with 57 passed and one failed: exact Inter pixel comparison at weight 500 differs on Linux, although Windows passes. The preceding candidate passed the full Linux browser suite; Vercel preview is ready. Independent review of the recent font/Intl changes reported one font concern; an actual-browser regression disproved it because Tailwind expands the inline theme token to the correct font stack. A subsequent independent whole-branch source review through 39b628a found no new actionable issue; it does not resolve the runtime font or performance failures.

## Mobile performance

Lighthouse 13.5.0, production server on localhost:3100, Linux Chromium in the isolated GitHub Actions performance job, default mobile simulation, three runs per locale. Values below are independent medians from [run 38997466726](https://github.com/Let-cal/My_Portfolio/actions/runs/38997466726), commit `39b628a`.

| Locale | Performance | Accessibility | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| EN | 83 | 100 | 3617 ms | 287 ms | 0.00138 |
| JA | 88 | 100 | 3668 ms | 216 ms | 0.00138 |
| VI | 84 | 100 | 3622 ms | 240 ms | 0.00138 |
| Required | ≥85 | ≥95 | ≤2500 ms | ≤200 ms | ≤0.1 |

All locales still fail LCP and TBT; EN and VI also fail Performance. The preceding 40f4813 run passed TBT and Performance for all locales (P88, TBT124–150 ms), but that improvement was not stable across the next runner sample. Do not merge or declare the FE complete from these results. These lab measurements do not establish field INP or physical mobile GPU performance. Windows results and earlier Lighthouse 12 measurements are not directly equivalent to this runner.

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

## Deployment cross-check

Vercel CLI authenticated access verified preview deployment dpl_385dkRQDsojqqyo94A8danshGXxN as Ready, using Next.js/Node 22. Origin-scoped development OIDC requests return the real portfolio with HTTP 200, Brotli encoding and a CDN cache hit; Deployment Protection was not changed. The connector itself returns a scoped 403, so CLI results are the current evidence. An isolated three-run EN preview diagnostic observed HTTP/2 and independent medians P91/A100/LCP3122 ms/TBT172 ms/CLS0. It also fails LCP and does not replace the localhost CI gate. Only whitelisted metrics were saved; authenticated headers and tokens were not persisted.
