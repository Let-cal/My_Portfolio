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

## Second approved Linux trial — diagnostic result

[CI run 40088922519](https://github.com/Let-cal/My_Portfolio/actions/runs/40088922519) tested PR head `4c0f9623db697bba7728ba33e4f0ee775e625560`, merge revision `11eab2744c285d5e92450710298dc3ebe974dfc5`.

- [CodeQL 40088922486](https://github.com/Let-cal/My_Portfolio/actions/runs/40088922486) passed: the original file-system race no longer blocks this revision.
- Linux quality passed **115 files / 1,250 unit tests, zero skipped tests**. Both native symlink checks therefore executed rather than receiving a Windows skip.
- The real backend again failed before the browser, now specifically at `realtime-anonymous-join-denial`, after **19 completed checks**. This includes admin/member authentication, hidden/public RLS controls, private schema/history/Storage checks and successful admin private-channel subscription. It does not establish negative Realtime authorization or delivery.
- Launcher duration: 102.543 seconds including cleanup. All six migrations, fixture setup and both scoped cleanup steps passed again. The complete admin job took 2m18s. Actual full browser/admin runtime is still unknown.

### Realtime contract correction prepared locally

The failure checkpoint led to a source-level contract defect in the test classifier. The pinned CLI's Dockerfile selects `supabase/realtime:v2.147.1`. That server constructs the authorization message in its channel module, then `Logging.build_msg` prefixes it with `Unauthorized: `. Installed `realtime-js` 2.117.3 preserves the complete reply reason in `Error.message`. The original test classifier expected only the inner message and consequently rejected the server's documented authorization response.

The local correction requires the exact **prefixed** message for `admin:content` and `CHANNEL_ERROR`. Bare inner text, other topics, timeouts, transport and JWT/setup errors remain failures. This is not a broad substring match or an authorization-policy change. The checkpoint and source evidence support this defect diagnosis; only a subsequent real Linux run can establish that it resolves the observed integration failure and allows the remaining cases to pass.

Pinned primary sources:

- [CLI 2.122.0 service image](https://github.com/supabase/cli/blob/v2.122.0/apps/cli-go/pkg/config/templates/Dockerfile#L36)
- [Realtime 2.147.1 authorization handling](https://github.com/supabase/realtime/blob/v2.147.1/lib/realtime_web/channels/realtime_channel.ex#L179)
- [Realtime 2.147.1 reason prefix](https://github.com/supabase/realtime/blob/v2.147.1/lib/realtime_web/channels/realtime_channel/logging.ex#L65)
- Installed SDK: `node_modules/@supabase/realtime-js/src/RealtimeChannel.ts`, receive-error handler.

Targeted RED: 52 passed / 2 failed before correction. Targeted GREEN: 57 passed including sanitized-progress tests; independent reviewer reran them with the same result and reported no blocking findings. Fresh quick checks and the full **618 script/budget tests** passed. No application, workflow, timeout, permission, gate threshold or mandatory scenario was changed. Full application build/unit results remain those of the unchanged application on the second Linux trial; they were not rerun locally for this helper-only correction.

## Third approved Linux trial — backend accepted, browser blocked

[CI 40090057834](https://github.com/Let-cal/My_Portfolio/actions/runs/40090057834), head `82623ff`, merge revision `432396d7196c8d27c522dfe0394a8f27a984d768`, confirmed the Realtime contract correction: **22 real backend checks passed**. All six migrations, provisioning, the production build and scoped cleanup also passed. The six browser cases each executed once, but **zero passed**; the browser phase lasted 29.429 seconds including teardown. This identifies a common early browser/fixture problem but not its cause. No signed-in raw logs were exported.

Quality, CodeQL, Gitleaks, production audit, Lighthouse gate, public browser aggregation and Vercel preview passed at this head. That does not override the mandatory admin failure. Launcher total: 168.301 seconds; complete admin job: 3m28s. This remains a failed partial run, not a successful end-to-end benchmark.

Under the owner's explicit ordinary-test repair/rerun approval, the next diagnostic increment records each mandatory scenario's fixed outcome, allowlisted source coordinates and a fixed failure category. The artifact projection validates those fields independently and drops arbitrary data. Privacy regression tests use sentinel secrets to verify that raw errors, causes, stacks, assertion values and attachments are not retained in the exported diagnostics. No signed-in DOM, trace, screenshot, password or token is published.

Local verification: quick checks, all **621 script/budget tests** and **13 privacy unit tests** passed. Independent review reran 11 reporter tests and 13 privacy tests and found no blocker or false-PASS/raw-data export path. Actual browser recovery still requires Linux. A provisional selector diagnosis was withdrawn after review confirmed `ResourcePage` already renders `<main>`; the original selector and readiness assertion are retained. No UI/source app, workflow, policy, permission, threshold or test coverage was changed.

## Fourth Linux trial — common login helper identified

At head `466c85c`, [CI 40090944780](https://github.com/Let-cal/My_Portfolio/actions/runs/40090944780) again passed all 22 backend checks, migration replay and the production build. Its six browser attempts failed at their common login-helper call sites, with category `other`. The initial diagnostic selected the test call site ahead of the deeper helper frame, so it did not yet identify the failing predicate. This is insufficient evidence to change authentication behavior or loosen assertions.

The next bounded diagnostic increment selects the first allowlisted stack frame and assigns fixed categories to the helper's existing errors. Its compound identity guard is expressed as four equivalent checks (API key present, access token is a string, expected synthetic email, authenticated role) so a failure can report exactly which predicate failed without exposing any values. All predicates and required scenarios remain mandatory. No raw response or arbitrary error text is exported. The source application and workflow are unchanged.

## Fifth Linux trial — response body lifetime in the login harness

At head `12e5f01`, [CI 40091696931](https://github.com/Let-cal/My_Portfolio/actions/runs/40091696931) again passed the 22 real backend checks. Every browser failure now points precisely to `fixtures.ts:152`, the `response.json()` call after `Promise.all` has already waited for full-page login navigation. This is a document-lifetime dependency in the harness; it is not evidence of a failed application authentication policy. The earlier provisional-header hypothesis was not the reported failure location.

The correction captures successful HTTP status and actual request headers when the login response arrives, then verifies the actual UI-created session cookies after navigation through the installed official Supabase SSR adapter. `getUser(token)` validates the expected synthetic email and authenticated role through the real local Auth API. No additional sign-in, fabricated token, response substitution or route mock is introduced. The verifier is restricted **before transmission** to `GET /auth/v1/user` on this local API; refresh, repair, mutations, query/fragment and other origins are rejected. The browser still performs every login and required admin/member route assertion.

Focused lifetime tests demonstrate that the helper never reads a post-navigation body or provisional request headers. These are unit API-contract tests, not substitutes for real service/browser evidence. The offline failed-request predicate likewise uses the SDK's actual header accessor while retaining its URL, POST and Next-Action criteria. Independent review accepted the auth proof; its refresh-possibility minor was addressed by the strict read-only fetch guard. Actual browser acceptance remains pending a successful Linux run.

## Sixth Linux trial — five browser scenarios accepted

[CI 40092696648](https://github.com/Let-cal/My_Portfolio/actions/runs/40092696648), head `b596484`, merge revision `3dcedd1abd78c985af68ea220c3393af6787cb2f`, passed **22 real backend checks** and **5 of 6 browser scenarios**: authentication/denial, CRUD/visibility/order, drafts, real Realtime conflicts/deletion and cross-tab signout/reauthentication. This confirms recovery from the login response-lifetime problem through actual UI-created cookies and live Auth verification.

Only offline recovery failed, with the first frame at the shared Save-click helper. That artifact does not distinguish the create-time click from the recovery-time click, nor prove why the click failed. The rest of quality, public browser aggregation, security, CodeQL, Lighthouse and Vercel preview passed; overall release remains blocked by the admin scenario.

The bounded next adjustment keeps every offline error/banner/value/URL/enabled-control/unchanged-backend check. The pointer moves away normally, and the test requires the network notification to expire naturally before the final ordinary Save click. The final click is in the spec to improve future attribution. Sonner's installed source intentionally pauses notification expiry while hovered; this is a supported timing hypothesis, not captured proof of interception. No forced click, manual dismissal, hidden overlay, fixed sleep, retry, skipped case or timeout relaxation is used.

Independent review accepted the adjustment without a blocking finding. Residual coverage limit: it proves saving after natural notification expiry, not that Save remains clickable beneath a visible notification. The potential overlap remains a separate UX observation; no source UI behavior is changed or claimed fixed by this test-only change. Fresh local quick checks passed; actual recovery must still pass on Linux before merge.
