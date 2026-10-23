# Next.js patch required by the release gate

## Reason and scope

The required production audit failed after owner-approved release head `b79b424` was pushed to PR #16. The [Linux security run](https://github.com/Let-cal/My_Portfolio/actions/runs/39981645488/job/120510181312) and a fresh local `npm audit --omit=dev --audit-level=high --json` returned the same advisory set for the locked Next.js `16.4.0` package. The failing result is preserved; no audit threshold, workflow or advisory exclusion was changed.

| Vendor advisory | Reported severity | Vendor fixed version |
| --- | --- | --- |
| [Image Optimization API](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) | Critical | 16.4.1 |
| [App Router Server Actions denial of service](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) | High | 16.4.1 |
| [Cache Components returning typed arrays](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) | Critical | 16.4.1 |

This records package advisory findings, not proof that the deployed application was exploited or meets every exploit condition. The vendor documents Sharp >=0.35.5 as an image-specific workaround; this project already has that version, but it does not resolve the other Next.js advisory findings.

The remediation pins `next` and `eslint-config-next` to the official [16.4.3 patch release](https://github.com/vercel/next.js/releases/tag/v16.4.3), updates their Next-family lock entries and retains all platform SWC packages. React, Playwright, the measured browser image, `@swc/core` override, product source, Auth/RLS and CI thresholds remain unchanged. No forced audit fix or broad dependency update is used.

## Local verification

| Check | Observed result |
| --- | --- |
| Production audit before the patch | Exit 1 on Linux and Windows; one affected Next.js package with three advisory entries |
| Production audit after the patch | Exit 0; zero vulnerabilities |
| Formatting, lint, generated assets and types | PASS; zero lint errors and one existing ResourceForm compiler warning |
| Unit tests | 114 files, 1222 passed |
| Production build | PASS, Next.js 16.4.3 with the existing webpack configuration |
| Initial JavaScript | EN/JA/VI 198.7KB gzip; quick view 182.4KB; existing 200KB gate preserved |
| Script and artifact budgets | 289 passed; zero skipped or failed |
| Public browser regressions | 63 passed on the owned local production server; zero skipped, flaky or failed cases and zero retries |

The dependency diff received independent review with no Critical, Important or Minor findings. Registry integrity, retained optional platform packages and existing peer requirements were checked. Local browser verification uses Windows D3D11, not Linux SwiftShader or a physical mobile device. No hosted authenticated writes or vulnerability probes are performed.

## Release conditions

The original conditional merge approval was for `b79b424`; the patch changes the reviewed revision. Publish and release the concrete new revision only after owner approval, all required checks on that revision, applicable preview evidence and final revalidation. Do not retry away the old audit failure or use its other green checks to authorize the new head.

The three CI performance measurements in [the runtime baseline](../ci-runtime-baseline.md#official-container-runtime-candidate-measured-2026-10-22) belong to `40974b1` before this framework patch. They remain historical evidence, not patched-revision Linux or production verification. The new revision needs normal CI, not another three-run optimization experiment. Merge, deployment and public production verification remain distinct states. No production deployment has been performed as part of this local preparation.
