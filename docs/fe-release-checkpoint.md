# Frontend release checkpoint — 2026-10-18

**FE v1 verification record and approved release policy.** Reviewed application revision: `9317fc973a6df54c78d291c0c4871cb8a066b976`. [PR #1](https://github.com/Let-cal/My_Portfolio/pull/1) records the final checks and merge; [GitHub Releases](https://github.com/Let-cal/My_Portfolio/releases) records the verified production revision and deployment. A ready preview alone does not establish release.

Final security review subsequently corrected CodeQL extension-rule severity parsing and removed exists/read races in two asset generators (`abb34d3`). Their generated outputs are byte-identical in isolated regression tests. The bounded exception is rebound to this reviewed build-input revision; the website design and runtime source remain unchanged. New CI must verify the corrected scanner and final release revision.

Cross-platform build verification then found that Linux AVIF re-encoding changes committed asset bytes. Build revision `56d9889` now verifies and uses the committed images, icons and sprite; `npm run generate:assets` performs deliberate regeneration separately. No artwork was changed. The final exception fingerprint is bound to this reviewed build revision. The production build, 55 artifact/script tests, lint and TypeScript pass locally; fresh Linux checks remain mandatory.

## Current verification

- [CI run 38999198200](https://github.com/Let-cal/My_Portfolio/actions/runs/38999198200) passes quality (lint, unit tests, production build, types, initial JavaScript and artifact budgets) and the full Linux Chromium suite. The Linux weight-500 font raster regression is resolved by retaining cmap aliases needed by FreeType autohinting; exact pixel assertions remain in place.
- The same revision passes Gitleaks, production dependency audit, read-only CodeQL and Vercel preview. Mobile Lighthouse is the only failing required check.
- Local verification recorded 844 unit tests, 58 browser tests and 43 artifact/script tests, plus build, lint and TypeScript. Browser coverage includes Skills hover/wheel stability, bounded moving backdrops, mobile anchor navigation, font fallback, printing and metadata.
- HTML-referenced home JavaScript is 196.8 KB gzip on EN/JA/VI (budget 200 KB); quick view is 176.3 KB. This scope excludes later dynamic chunks; Lighthouse includes actual startup work.
- Production dependency audit reports zero vulnerabilities. Development tooling has separately documented upstream braces advisories; the production check is not suppressed.
- An independent whole-branch source review through `39b628a` found no new actionable issues. That review predates the subsequently verified font alias fix and does not constitute a performance waiver.

## Mobile CI measurements

Lighthouse 13.5.0; Linux Chromium; production localhost server; default simulated mobile profile; three runs per locale. Each cell is the independent median from run 38999198200.

| Locale | Performance | Accessibility | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| EN | 85 | 100 | 3318 ms | 239 ms | 0.00138 |
| JA | 91 | 100 | 3165 ms | 144 ms | 0.00138 |
| VI | 89 | 100 | 3317 ms | 116 ms | 0.00138 |
| Existing release requirement | ≥85 | ≥95 | ≤2500 ms | ≤200 ms | ≤0.1 |

All locales pass Performance, Accessibility and CLS. All fail LCP; English also fails TBT. These are loading-performance shortfalls under this lab profile, not evidence that navigation or content is broken. They do not establish real-user INP, abandonment rates or physical-phone performance. Earlier CI samples varied; a single good sample is not a permanent guarantee.

## Deployed candidate cross-check

At the assessment, Vercel CLI confirmed preview `dpl_J49qFNicwQ6TfQJ2HkE5CAvwXmyS` Ready; the GitHub Vercel status for `9317fc9` linked to that deployment. Next.js/Node 22 and the plan-default build machine were configured. Production verification is recorded separately in GitHub Releases.

On 2026-10-18, isolated Windows headless Chrome measured the English preview over HTTP/2. Three cold Lighthouse 13.5.0 runs used the default profile for each form factor, normal page behavior and independent medians:

| Profile | Performance | Accessibility | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop | 99 | 100 | 694 ms | 20 ms | 0.00015 |
| Mobile | 91 | 100 | 3224 ms | 114 ms | 0 |

These are additional lab observations, not substitutes for CI or field Core Web Vitals. An origin-scoped development OIDC header enabled preview access; protection was not disabled. Only whitelisted metrics were retained, never credentials or authenticated raw reports. The scoped connector 403 was handled through the authenticated CLI.

Separately, desktop RAF cadence at five live-scene chapters was approximately 60 callbacks/second on an RTX 3050 laptop, including the forced low scene tier. That measures callback cadence on this hardware, not GPU frame completion or performance on a physical low-end phone.

A normal-motion Chromium phone-touch smoke on the same protected preview passed for EN/JA/VI: no page/header horizontal overflow at 320/360/390 px; touch PM selection; selected-role PDF retrieval with a real PDF signature; Skills navigation; locale switching preserving role and anchor; case-study open/close; reachable contact and mailto link; quick view and browser-back restoration; no live mobile canvas; no uncaught page errors. This is browser emulation, not physical Android or iPhone Safari verification. It does not verify external mail delivery or clipboard permission denial.

## Release decision under review

The owner clarified that recruiter desktop review is the primary audience and approved the proposed FE v1 exception on 2026-10-18: LCP≤4000 ms and TBT≤300 ms for the reviewed application content, expiring on 2026-10-25 23:59:59 Asia/Ho_Chi_Minh. P≥85, A≥95, CLS≤0.1 and the seven required check names/protection remain in force. The original LCP2500/TBT200 goals remain visible in reports and [issue #2](https://github.com/Let-cal/My_Portfolio/issues/2).

See the [release assessment](fe-release-assessment.md) for the approved decision and research. Fresh checks under this scoped policy are required before merge. Do not describe this candidate as meeting the original mobile budgets or passing field Core Web Vitals.

See [CI and release procedure](ci-release.md). Backend/admin work follows the verified frontend release.
