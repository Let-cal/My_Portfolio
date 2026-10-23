# CI runtime baseline

The latest completed experiment is the [official container runtime candidate](#official-container-runtime-candidate-measured-2026-10-22). Earlier candidates below remain historical evidence, including unsuccessful optimization attempts.

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

## Duration-balanced candidate: measured 2026-10-22

All three approved trials use head `f607552d1e20c128843908fb9defcf98c910d3cf`, unchanged base `7bd27ee262fc215b4f99286cd6d499756d733b0b`. The PR checkout `c42c54edc119fb8b4dacf1c783aca8696e570d85` and head have the same source tree `4d7c16847b914be67094e5d8c351cfe28239df5a`. Actual report metadata, full discovered identity union and generated plan artifacts were reconciled for each run: 56 + 7 tests, all 63 passed, no skipped/flaky/unexpected cases. The public application and browser assertions are unchanged from the previous candidate.

| Run | Workflow elapsed | Summed job occupancy |
| --- | --- | --- |
| [39784704537](https://github.com/Let-cal/My_Portfolio/actions/runs/39784704537) | 1387s (23m07s) | 2023s (33m43s) |
| [39784816468](https://github.com/Let-cal/My_Portfolio/actions/runs/39784816468) | 777s (12m57s) | 1794s (29m54s) |
| [39786829665](https://github.com/Let-cal/My_Portfolio/actions/runs/39786829665) | 1077s (17m57s) | 2057s (34m17s) |

The median is **17m57s elapsed / 33m43s runner occupancy**, versus the previous candidate's 16m32s / 25m11s: 85s (8.6%) slower and 512s (33.9%) more occupancy. Against the older historical main baseline, elapsed is only 35s lower while occupancy is 727s higher. The shared runners and different workflow revisions prevent a controlled causal claim. No slow trial was excluded or silently rerun; the first two workflows overlapped, and the third started only after the second completed.

**Observed bottleneck:** job `119846541197` ran apt at 13:16 UTC. Its log records `Fetched 25.9 MB in 8min 38s (50.0 kB/s)` before system/font package setup. Chrome and its headless-shell archives then downloaded in seconds. This delay is included in the first run's 23m07s total. Better distribution of expensive cases alone did not deliver a stable workflow improvement.

**Decision:** do not merge `f607552` as a completed CI performance optimization. Keep main unchanged and address repeated browser-runtime preparation before a new approved measurement. The official preinstalled Playwright image is a separately prepared follow-up, with its own container pull/runtime verification pending. Passing the correctness gates does not establish the performance goal.

## Official container runtime candidate: measured 2026-10-22

The three authorized runs use head `40974b12a46e1bebe655d2b34bc07f180533fd1c`, base `7bd27ee262fc215b4f99286cd6d499756d733b0b`. The PR checkout `aa335e7784732ad7031ef9ac100cca660e14d354` and head have the same tree `7194356b99239e8ef1278605a67487725efbf3b2`. Trial 2 started only after trial 1 passed all mandatory gates; trial 3 started only after trial 2 completed. No trial was cancelled, replaced or excluded.

| Run | Official workflow elapsed | Through last completed job | Post-job status/finalization gap | Summed job occupancy |
| --- | --- | --- | --- | --- |
| [39810563429](https://github.com/Let-cal/My_Portfolio/actions/runs/39810563429) | 829s (13m49s) | 827s | 2s | 1572s (26m12s) |
| [39812889932](https://github.com/Let-cal/My_Portfolio/actions/runs/39812889932) | 1365s (22m45s) | 790s | 575s | 1486s (24m46s) |
| [39816113639](https://github.com/Let-cal/My_Portfolio/actions/runs/39816113639) | 683s (11m23s) | 682s | 1s | 1329s (22m09s) |

The official Actions timing endpoint independently reports the same `run_duration_ms` as `updatedAt - createdAt` for each run. The last-job span is separately computed from creation through the latest completed job timestamp; it includes job scheduling and execution. The post-job gap is the remaining interval until workflow status updates, not a measured browser runtime or necessarily runner waiting. Summed job durations remain an occupancy proxy, not billed usage.

All five CI jobs succeeded in every run. Actual JSON and generated plans reconcile against fresh discovery, exact group selection, revision/run/attempt and a complete disjoint union: **56 + 7 = 63 expected in every trial; zero skipped, flaky or unexpected cases**. The seven required PR contexts also pass at the evaluated `40974b1` head. The unchanged suite includes the veil/flicker, locale, responsive, keyboard, motion and gesture regressions; no frame samples or assertions were reduced.

### Runtime identity and measured tradeoff

The Docker pull logs from all **nine** runtime jobs (two browser groups plus Lighthouse in each run) resolve the official version tag to exactly:

```text
mcr.microsoft.com/playwright:v1.64.0-noble@sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f
```

The prepared release pins that same runtime. The measured runs used the version tag; local Docker execution is still unavailable and is not claimed. The immutable reference and a test enforcing its equality/version do not themselves constitute final-head Linux verification.

| Median metric | Historical single-browser baseline | Previous duration candidate | Container candidate |
| --- | --- | --- | --- |
| Official workflow elapsed | 1112s (18m32s) | 1077s (17m57s) | 829s (13m49s) |
| Summed job occupancy | 1296s (21m36s) | 2023s (33m43s) | 1486s (24m46s) |

Observed elapsed median is 283s / **25.4% lower** than the historical baseline and 248s / **23.0% lower** than the previous duration candidate. Occupancy is 537s / **26.5% lower** than the previous candidate, but 190s / **14.7% higher** than the historical single-browser pipeline. The two-browser-runner choice trades additional aggregate compute for lower observed wall time; no paid or larger runner was introduced. The median last-job span is 790s (13m10s), an explanatory metric only, not a replacement for the primary official elapsed result.

### Service condition and keep decision

[GitHub Status](https://www.githubstatus.com/) reported Actions degraded performance from 15:28Z during this experiment (incident `wq8305lppdc2`). Trial 2's final job actually completed at 16:31:32Z, while earlier API snapshots continued to show it queued. Workflow status finalized at 16:41:07Z. The 575s gap is retained in the primary 1365s result. This is consistent with the incident, without proving its specific cause. Do not infer that the aggregate spent those 575s waiting for a runner.

These are three shared-runner observations, not controlled same-machine A/B measurements or proof of stable healthy-service latency. Historical baselines span different revisions and include an additional media case. Preserve those limitations alongside the improved observed median; do not promise a fixed PR completion time.

**Decision:** keep the container candidate prepared for owner review. It preserves coverage, removes the proven repeated apt preparation, and improves the observed elapsed and previous-candidate compute medians. The occupancy increase versus the historical baseline and the service incident are explicit tradeoffs. Stop this authorized experiment at three runs; no additional performance workflow or recurring benchmark is added. Publishing the concrete immutable pin, passing all mandatory checks on the final revision, and explicit owner CI/CD merge approval are still required. PR #15 and real Auth/CRUD/reviewer integration remain separate; no production release has occurred.
