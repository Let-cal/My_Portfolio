# Task 4 local verification — 2026-10-24

## Status and source

**Prepared for owner approval of CI/CD publication. Real service validation is BLOCKED until the first approved Linux execution.**

Branch: `feat/admin-integration-safety`, based on released main `a5841380be5f37bd6ba1746a110e26031b61875c`. Preparation and checks used an isolated worktree. The original checkout remains at `9dfd3edd2eb6c77293fbc68afa4a8df7307cc1c3`; its server on port 3000 was not used or stopped. No source application, public visual asset or deployed migration was modified by this increment.

## Verified locally

| Check | Observed result |
| --- | --- |
| `npm run verify` | Exit 0; format, lint, generated assets, TypeScript, unit tests, production build and budgets passed |
| Unit tests | 115 files, 1,236 passed |
| Script/budget tests | 614 passed; zero failures, skips or cancellations |
| Public browser regression | 64 tests / 64 attempts, zero unexpected, flaky, skipped or retried cases; owned production server on port 4328 |
| Initial JavaScript | EN/JA/VI 198.6 KB gzip; quick route 182.4 KB; 200 KB budget retained |
| Full `npm audit --json` | Zero advisories at verification time |
| Scope diff | Existing required-check names, public-suite assertions/runtime and gate thresholds unchanged |

Lint reports one existing `react-hooks/incompatible-library` warning in `ResourceForm.tsx` for React Hook Form's `watch`; zero lint errors. This source was not changed. Windows public-browser results do not establish Linux renderer behavior. The browser regression preceded the final helper-only review fixes; no application, asset or dependency changed afterward.

Ignored local logs are retained in `.superpowers/sdd/2026-10-21-final-review-release/`, including `task4-reviewed-verify.log`, `task4-audit-reviewed.json`, `task4-public-browser.json` and the targeted RED/GREEN evidence. Raw credentials and signed-in artifacts are not included in this report.

## Independent review

The whole-branch review requested five important fixes. A bounded implementation pass and scoped independent re-review resolved all five; the final re-review reported no remaining Critical, Important or Minor findings in that scope.

| Finding | Implemented correction |
| --- | --- |
| Hidden-row writes did not prove write denial on readable rows | A separate published fixture is readable by anonymous/member clients before UPDATE/DELETE attacks; admin reads compare the complete row after each attempt |
| Generic request errors could masquerade as permission denial | Match authorization-specific schema/history/Storage codes and reasons; history and Storage include admin success controls; reject transport and missing-function errors |
| Private Realtime checked only an admin success | Require exact anonymous/member authorization rejection as well as successful admin subscription and actual delivery; timeouts are failures |
| Docker inspection did not verify bind addresses | Create an owned bridge with an IPv4 loopback default; verify its identity and every published service binding; remove only the owned bridge |
| Browser report validated counts without mandatory identities | Bind discovery and executions to six exact scenarios, file, project and current run; validate identities again when projecting the artifact |

The bind regression demonstrated 13 passing and 7 failing tests before the fix, then the expanded runtime/launcher suite passed. Reporter and backend classifier fixes also have targeted RED/GREEN coverage. Pure tests verify the guards, not the real backend.

## Remaining acceptance gates

1. Owner approval to push this concrete CI/CD candidate, open its PR and run the first real Linux verification. This is one functional validation, not another three-run speed experiment.
2. On Linux, replay all migrations on an empty owned stack, verify actual Auth/RLS/Storage/Realtime behavior and all six browser cases, inspect sanitized phase timings and investigate every failure. Docker is unavailable locally; none of those live-service checks is claimed passed here. Exact Realtime rejection compatibility with the CLI's service image remains to be verified.
3. Report the actual Linux outcome before seeking separate permission to merge/deploy this CI/CD increment. The extra parallel job increases runner occupancy and may extend the critical path; no performance improvement is claimed for added coverage.
4. Integrate media-library PR #15 only under its own approval, then add its browse/picker/reference/deletion-protection cases. Prepare Task 5 read-only reviewer Auth/RLS separately.

No hosted migration, real-data CRUD, account, secret, branch-protection or billing change was performed. See [the implementation contract](local-admin-integration.md) for lifecycle and privacy boundaries.
