# Task 4 — first Linux trial (2026-10-24)

## Outcome

**FAIL — PR #18 is not ready to merge.**

- PR head: `97dbaa4b882b7e888456f8f9076e9d2417b95a69`.
- Tested PR merge revision: `4407e76f00e8026e569079b796f22059ecb1852a`, confirmed through the current pull-request API.
- [CI run 40086853219](https://github.com/Let-cal/My_Portfolio/actions/runs/40086853219): 10:40:37–10:53:54 UTC, **13m17s** elapsed. This includes an admin job that failed early and is not a full successful integration benchmark.

| Check | Actual result |
| --- | --- |
| Quality: lint/types/unit/build/budgets | PASS, 3m46s |
| Public browser shard 1 | PASS, 54 tests / 54 attempts |
| Public browser shard 2 | PASS, 10 tests / 10 attempts |
| Public browser aggregation | PASS; all 64 cases, no retries, skips, unexpected or flaky outcomes |
| Lighthouse gate | PASS, 3m34s; existing advisory loading signals remain visible |
| Gitleaks / production npm audit | PASS |
| Vercel preview | PASS (no production deployment or merge) |
| Disposable admin | FAIL, 2m06s; stopped at backend probes before browser/build |
| Read-only CodeQL | FAIL; one high `js/file-system-race` finding in the test fixture reader |

## Real disposable backend evidence

The sanitized integration artifact records:

- Fresh namespace and owned bridge creation; service ownership and IPv4 loopback inspection passed.
- All **6 committed migrations** replayed; synthetic fixture provisioning passed.
- Backend phase failed before the six browser scenarios; `realServicesVerified` is false.
- Scoped project stop and owned network removal both succeeded.
- Launcher total: **97.719 seconds**, including teardown. Stack startup: 77.344 seconds. The reported final backend phase duration includes subsequent teardown; it is not a pure request latency.
- Actual runner browser: Google Chrome 155.0.8059.39.

No hosted Auth/RLS, shared-database write, real credential or production service was involved. No signed-in DOM, Auth response, password, token, trace or private raw log was exported.

## Investigation and local follow-up

The original backend summary intentionally exposed only its phase. That evidence does **not** identify the failing assertion or establish a root cause. The diagnostic follow-up records only an allowlisted checkpoint, bounded completed-check count and fixed failure category. Unknown fields and raw errors remain excluded. It preserves every Auth/RLS/Realtime assertion; no timeout, denial criterion or test requirement is relaxed.

[CodeQL run 40086853274](https://github.com/Let-cal/My_Portfolio/actions/runs/40086853274) reported severity 7.7 at `tests/e2e-admin/settings.ts:84` on the original revision. The follow-up validates file metadata and reads bytes through the same opened descriptor, retaining the private-path, size, ownership and link checks. The finding is not suppressed. CodeQL acceptance on the new revision still requires a real Linux run.

Local follow-up verification and its reviewed commit are recorded in the PR before any subsequent publication request. The original [local verification report](admin-integration-verification-2026-10-24.md) remains the preparation snapshot; it does not claim this failed trial passed. Concrete workflow publication and merge approvals remain distinct.

## Follow-up local verification

- Fresh `npm run verify` exited 0: 115 unit files, **1,248 passed and 2 platform-specific native symlink tests skipped on Windows**, 617 script/budget tests passed, production build and unchanged 198.6 KB EN/JA/VI initial JavaScript. The two native cases must execute on Linux; they are not counted as locally passed. Linux mode/UID policy has additional controlled-metadata coverage locally.
- Backend diagnostics demonstrated three failing tests before implementation, then passed the targeted helper/denial/launcher checks. The artifact projection accepts only fixed checkpoint IDs, a bounded integer count and fixed category; original errors are not retained as causes.
- Independent scoped review found no blocking issues in the diagnostics or reader fix. One minor remains: opening a FIFO at the private fixture path could wait for a writer before file-type inspection. The owned launcher generates a fresh regular fixture and does not accept a user-provided path; unexpected runner resource replacement is outside this trusted-runner consistency model. Job timeouts remain unchanged. Record this robustness limitation rather than claiming protection against malicious same-UID runner code.
- CodeQL and real backend acceptance on the follow-up revision are still pending. No thresholds, workflow permissions, Auth/RLS policy, test inventory or production source was relaxed to obtain a pass.
