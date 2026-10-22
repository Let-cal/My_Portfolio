# CI runtime baseline

Read-only inspection on 2026-10-22 of `Let-cal/My_Portfolio`. These are historical successful runs, not candidate measurements or proof of release readiness. All times below come from GitHub job/step timestamps or the original browser log; no JSON reports were reconstructed.

| Run | Reported head SHA | Workflow elapsed | Quality job | Browser job | Lighthouse job | Sum of job elapsed |
| --- | --- | --- | --- | --- | --- | --- |
| [39621568479](https://github.com/Let-cal/My_Portfolio/actions/runs/39621568479) | `9dfd3edd2eb6c77293fbc68afa4a8df7307cc1c3` | 762s | 219s | 537s | 204s | 960s |
| [39616710326](https://github.com/Let-cal/My_Portfolio/actions/runs/39616710326) | `757c532d154aa5fb1693a1c951724e0f02cbf9a3` | 1123s | 178s | 939s | 232s | 1349s |
| [39605857504](https://github.com/Let-cal/My_Portfolio/actions/runs/39605857504) | `0b157f6a66487702ccd23039596adc855a3f3b7f` | 1112s | 144s | 936s | 216s | 1296s |

Workflow elapsed is `updatedAt - createdAt` (UTC), including scheduling and finalization; it is not the sum of parallel jobs. Sum of job elapsed is an observed runner occupancy proxy, not billed usage. Reported head SHA is GitHub's run metadata, not independently verified checkout/merge SHA.

## Browser breakdown and provenance

| Run | Initial job wait | Browser setup before suite | Browser suite step | Playwright log total | Passed | Slow file log |
| --- | --- | --- | --- | --- | --- | --- |
| 39621568479 | 5s | 39s | 495s | 8.2m | 64 | `tests/e2e/veil.spec.ts` 5.2m |
| 39616710326 | 3s | 52s | 885s | 14.7m | 64 | `tests/e2e/veil.spec.ts` 9.9m |
| 39605857504 | 28s | 54s | 878s | 14.6m | 64 | `tests/e2e/veil.spec.ts` 9.8m |

Initial wait is workflow creation to first quality-job start. Browser setup is browser-job start to suite-step start; browser starts 5s, 3s and 3s after quality completion respectively. Browser post-suite overhead is 3s, 2s and 4s respectively. The suite step includes application startup/build orchestration; no distinct browser build step exists in these job records. Do not subtract rounded reporter totals to invent build or wait time.

Quality production-build steps take 52s, 43s and 36s; Lighthouse builds take 36s, 49s and 44s. Browser dependency installation takes 13s, 24s and 23s; Chromium/library installation takes 18s, 23s and 22s. Remaining browser setup includes checkout, Node and runner setup.

The browser log's slow-file diagnostic and individual test lines identify the hotspot. In run 39621568479, light/dark Skills scroll cases take 1.4m/1.6m and the backdrop-node case 1.5m. Corresponding values are 2.8m/3.2m/2.8m in 39616710326 and 2.8m/3.1m/2.8m in 39605857504. These are rounded reporter values, not exact per-test JSON durations. The slow-file diagnostic appears at 15:11:06.610 UTC, 14:44:22.215 UTC and 13:30:13.886 UTC on 2026-10-21 respectively. The oldest run is labeled `UNKNOWN STEP` by `gh --log`; its job/step timestamps remain available through run metadata.

All three runs conclude success and print `64 passed`. This is log evidence, not a validated JSON outcome/retry inventory. Browser failure-report upload is skipped in each run; that conditional diagnostic upload is not a skipped mandatory test. No complete success JSON artifact is available from that upload path, so exact attempt sums, retry costs and complete outcome reconciliation remain unavailable. Do not treat green GitHub status as the strict summary gate passing.

## Reproduction and candidate comparison

For each run ID above, use read-only commands:

```powershell
gh run view <id> --repo Let-cal/My_Portfolio --json headSha,createdAt,startedAt,updatedAt,conclusion,jobs
gh run view <id> --repo Let-cal/My_Portfolio --log
```

Inspect browser summary/slow-file lines and step timestamps. Preserve assertions and coverage when measuring a candidate. Compare at least three successful representative candidate runs, recording exact revision/run attempt, complete shard inventory, elapsed and summed attempt durations, setup/build time, runner occupancy and any flaky outcomes. This baseline spans different revisions and has substantial timing variation; it establishes neither a cause nor an expected speedup. Candidate/Linux measurements and the keep/revert decision belong to Task 3 after concrete CI approval.

The local summary CLI is `node .github/scripts/playwright-summary.mjs <report.json>`. It reports elapsed duration separately from summed attempt time, includes retries, sanitizes labels and blocks invalid/incomplete reports, report errors, unexpected, flaky or skipped tests. It cannot detect an omitted test when both report tree and stats omit it; Task 2 must validate external discovery/shard coverage.

## Count-based candidate: measured 2026-10-22

All three trials use head `847e7f893a28eef5b26eabf4a546263f6742375f`, base `7bd27ee262fc215b4f99286cd6d499756d733b0b`. The PR merge checkout (`99f2e941c9e76914ce33c19594a81e03b06ea25f`) and dispatch head have the same source tree `ceb77dc15a5d8eca2789f612064f226d8109b022`. Current-run JSON reports were reconciled against the full discovered inventory: 63 expected, zero skipped/flaky/unexpected in every trial.

| Run | Workflow elapsed | Summed job occupancy | Veil attempt sum, all on group 2 |
| --- | --- | --- | --- |
| [39754274021](https://github.com/Let-cal/My_Portfolio/actions/runs/39754274021) | 1040s | 1511s | 600472ms |
| [39754407212](https://github.com/Let-cal/My_Portfolio/actions/runs/39754407212) | 992s | 1671s | 599627ms |
| [39756641052](https://github.com/Let-cal/My_Portfolio/actions/runs/39756641052) | 979s | 1411s | 429309ms |

Median elapsed is 992s versus historical 1112s: 120s / 10.8% lower. Median runner occupancy is 1511s versus 1296s: 215s / 16.6% higher. These are historical comparisons across source revisions, not controlled A/B measurements. The historical suite's 64th media case belongs to unmerged PR #15; it was not removed from the current 63-case main inventory. The first two candidate workflows overlapped on separate runners. One runner took 240s to install Chromium/Linux libraries. Shared-runner variability remains material; the fastest historical baseline (762s) beats every candidate trial.

**Decision:** do not merge the count-based candidate solely as an optimization. Preserve the existing coverage and improve partition balance before another approved measurement. The next local candidate assigns work by median successful first-attempt duration from these three trials. Its projected duration is a scheduling estimate, not a promised workflow runtime. New Linux runs and owner approval are still required before retaining or merging that revision.

### Timing seed maintenance

`.github/browser-timings.json` contains only synthetic public test names, durations and source-run provenance. It is a reviewed input, not an executable artifact downloaded from an arbitrary PR. To refresh it, use successful complete reports from the same source revision, verify their identity and zero skipped/flaky/unexpected cases, and take the median first-attempt duration per portable file/project/title path. Do not learn from retried failures or inflate weights with installation/build time. Refresh in a normal reviewed change when profiles drift; a stale seed can worsen balance but cannot remove current discovered tests. Renamed/new tests use the planner's positive fallback estimate. No recurring benchmark or additional workflow is introduced.

References: [Playwright test lists](https://playwright.dev/docs/test-cli#test-list), [sharding and report merging](https://playwright.dev/docs/test-sharding).
