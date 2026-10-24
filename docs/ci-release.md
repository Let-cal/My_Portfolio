# CI and release flow

## Disposable admin integration candidate

The separately reviewed [Task 4 candidate](local-admin-integration.md) adds only missing signed-in Auth/CRUD/RLS coverage to this workflow. Its native Docker job runs in parallel with existing work, uses synthetic data and no hosted secrets, and uploads only a sanitized summary. The current required check names, public 64-case suite and thresholds remain unchanged. Branch protection is not modified by YAML; once activated, the final-review agent must also require the scoped admin result before proposing this increment's merge.

This is a prepared local CI/CD change, not evidence of Linux/service success or permission to publish it. Concrete owner approval precedes push and the first real Linux validation. Full local-service verification is blocked while Docker is absent; media-library coverage depends on PR #15 and reviewer authorization remains a separate security increment. Phase timings will establish the added setup/build/browser cost. No faster total pipeline is promised for new coverage.

## Browser optimization experiment

PR #16's first count-based candidate at `847e7f8` completed three Linux measurements. Every run passed all 63 cases without skipped or flaky cases, but elapsed median fell only from the historical 18m32s to 16m32s while summed runner occupancy rose 16.6%. All six expensive veil cases still landed together. That is insufficient evidence to retain count-based sharding as a performance improvement. See [the measurements and limitations](ci-runtime-baseline.md).

The duration-balanced candidate uses the supported Playwright `--test-list` interface to assign two groups using measured durations. A committed, sanitized timing seed records its source revision and runs; timing data influences scheduling only, never which tests are required. Every runner discovers the current inventory, so new and renamed tests receive a fallback estimate and remain included. Non-veil files stay together; the independent veil cases may split between groups. Keep `veil.spec.ts` in parallel mode without shared lifecycle hooks or serial suites; a regression test guards that contract. Do not combine the generated test lists with native `--shard`: that would partition a second time and omit tests.

Publishing each concrete CI/CD revision requires owner approval. Predicted loads and local Windows runs do not demonstrate Linux acceleration. Required test assertions, frame samples, timeouts, one worker per runner, check names and release thresholds are preserved. The no-JavaScript motion test uses the configured server URL so verification can run on an owned alternate port.

### Follow-up: browser runtime preparation

The approved three-run experiment at `f607552` exposed another bottleneck: one job fetched 25.9 MB of Ubuntu packages in 8m38s, while Chrome downloads took only seconds. Count this startup cost in the end-to-end result; do not present balanced test sums as a complete CI improvement.

The version-tagged follow-up at `40974b1` uses the official `mcr.microsoft.com/playwright:v1.64.0-noble` image for the browser and Lighthouse jobs. The version must equal the locked Playwright version; a contract test enforces both job images. The image supplies browsers and their system/font dependencies, so the jobs still install locked npm packages but do not run apt/Chromium installation again. Explicit Bash retains the previous shell semantics, including `pipefail`; `--ipc=host --init` follows the upstream Chromium guidance. Quality and aggregate jobs stay on the existing standard runner.

At the pre-publication checkpoint for `40974b1`, container execution and the immutable digest were unverified: the public Microsoft registry reset workstation connections and Docker was unavailable locally. That checkpoint used the documented version tag. The approved Linux results and subsequent local digest pin are described below; no local Docker execution is claimed. Container pull/setup costs replace the old apt cost and must be included in measurements. A registry outage or image/version mismatch must fail the job, never fall back to skipped browser checks. No secrets or hosted admin session enter these synthetic jobs. The three `f607552` trials do not validate the container follow-up.

Reference: [official Playwright Docker image and runtime guidance](https://playwright.dev/docs/docker).

### Immutable runtime pin for release preparation

All three approved Linux runs (`39810563429`, `39812889932`, `39816113639`) passed all 63 browser cases and five CI jobs. Required PR checks pass at the measured head. Runner-generated Docker pull logs from all nine browser/Lighthouse jobs resolve the official version tag to the same digest:

```text
mcr.microsoft.com/playwright:v1.64.0-noble@sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f
```

The local release preparation locks that measured runtime rather than allowing the tag to resolve differently on a later run. The script contract requires both jobs to use the same digest and a version matching the SDK lockfile. This is not a new measured runtime or a claim of a local Docker execution. All three measurements stayed on the approved remote `40974b1`. Publishing the concrete pin and merging the CI change still require owner approval and green checks on the final revision; the old head's checks do not authorize a newer head.

The [completed experiment](ci-runtime-baseline.md#official-container-runtime-candidate-measured-2026-10-22) has official elapsed times 13m49s / 22m45s / 11m23s, with a median of 13m49s (25.4% below the historical single-browser baseline). Median summed job occupancy is 24m46s, 14.7% above that baseline and 26.5% below the previous duration candidate. GitHub reported Actions degradation during the experiment; trial 2 includes a retained 9m35s post-job status/finalization gap. These shared-runner observations support keeping the runtime candidate for owner review, not a fixed completion-time promise or healthy-service stability claim. No fourth measurement, new workflow, automatic merger or production release is part of this increment.

When updating Playwright, deliberately refresh the SDK lock and both official image references together, verify the pulled digest and run the existing regressions. A passing npm audit does not scan the container's operating-system packages.

## Checks

The 200 KB JavaScript check measures scripts referenced by the prerendered HTML, including script preloads. It does not measure every subsequent network request: Motion's feature chunks can load on mount, while scene and dialog chunks have separate loading gates. Lighthouse exercises the real page and includes that subsequent work. Treat the static-script result as a bundle scope, not as total startup transfer size.

Font artifact tests regenerate priority subsets in memory and compare hashes, cmap, outlines, metrics and variation data against the unchanged source fonts. The quality job installs uv 0.13.1 using `astral-sh/setup-uv` v10.3.0 pinned to commit `1c37ad07a6a961277cf70c0d37d6f313000f5884`; caching is disabled. The generator pins FontTools/Brotli in its script metadata. Browser tests separately compare rendered glyph pixels and widths and check initial locale font requests.

PRs targeting `main` and pushes to `main` run:

- **CI:** Node.js 22, `npm ci`, ESLint, unit tests, production build, `tsc --noEmit` after Next.js generates route types, the existing 200 KB initial-JavaScript gate, and artifact/script budgets. The browser candidate splits the complete Chromium suite over two independent standard runners, one worker each. Each builds and starts its own production server on port 3100; CI never reuses an existing server. Lighthouse remains parallel with browser jobs after quality. This adds one browser setup/build and an aggregate job, so compare total runner time as well as elapsed time before retaining the candidate.
- **Browser completeness:** the required check remains **Playwright Chromium on Linux**. It requires both group jobs to succeed, then validates JSON report revision/run/attempt and group metadata and the disjoint union against a fresh discovery of the full test inventory. Historical native shard reports remain readable; mixing native and duration-group modes is rejected, as is applying both modes to a report. Missing, duplicated, unexpected, skipped, interrupted or flaky mandatory evidence fails. Playwright also runs with `--fail-on-flaky-tests`; retry-only success cannot silently release. Verified blob reports are merged into one HTML report; no promoted build or production credential is used.
- **Lighthouse mobile:** a separate job builds production and collects three mobile Lighthouse runs for each of EN/JA/VI, using the median of each metric. Accessibility ≥95, SEO ≥90 and CLS ≤0.1 fail the job. Performance ≥85, LCP ≤2500 ms and TBT ≤200 ms are advisory: misses appear as warnings and in the job summary table, but do not block the merge, because lab loading metrics vary between runs on shared runners. Reports are uploaded with seven-day retention.
- **Security:** checksum-pinned Gitleaks CLI scans all fetched branches/tags and the PR merge history with default rules and redacted reports. Deleting a secret from the current tree does not clear its history finding. Production `npm audit --omit=dev --audit-level=high` fails on high/critical advisories or an audit-service error; it never runs `audit fix`.
- **CodeQL:** JavaScript/TypeScript with `security-extended` queries and no application build. PR jobs have read-only permissions, save SARIF for review, and fail on errors or security severity at least 7. Lower-severity findings still need review. Only the separate trusted `main` job can publish code-scanning results with `security-events: write`. A successful upload does not mean there are no alerts: review the Security tab before release. Avoid enabling a duplicate default-setup CodeQL workflow.
- **Dependabot:** weekly npm and GitHub Actions PRs, bounded to three and two open update PRs respectively. Minor/patch npm updates are grouped; major updates remain separate. Updates receive the same PR checks; no automatic merging is configured. The standalone Gitleaks binary/checksum needs a reviewed manual update.

Security and CodeQL also run weekly. Failure artifacts expire after three days. The browser candidate uploads each shard's JSON/blob evidence even on failure, then uploads a merged HTML report after successful aggregation, with three-day retention. These runs use public seed content only. Never reuse this artifact policy for real signed-in preview sessions; keep their raw traces/auth state private and ignored. Unit failures upload JUnit output. Logs remain available in Actions when a command fails before a report exists.

## Cost and trust boundaries

- This setup targets the verified **public** `Let-cal/My_Portfolio` repository. Every job checks that the repository remains public, uses standard `ubuntu-24.04` runners, and has a timeout. No larger runners, paid scanner service, deployment job, Lighthouse server, or persistent hosting is provisioned. Reassess this setup before making the repository private.
- Workflow concurrency cancels superseded runs. npm caches contain downloaded packages only; no `.next`, browser binaries, `node_modules`, or PR artifacts are promoted into trusted jobs. Artifact retention is short to limit storage.
- Keep the account's Actions spending budget at $0 with over-budget usage blocked. Public runner compute is free, but cache/artifact storage still consumes GitHub quotas. This change does not modify billing settings; check the existing budget before enabling the workflows.
- Workflow permissions default to `contents: read`. Checkout does not retain credentials. PR code runs only under `pull_request`, never `pull_request_target` or a privileged `workflow_run`. No repository secret, PAT, Supabase credential, or Vercel token is required. The app uses its seed content in this environment.
- All external actions use full commit SHAs resolved through GitHub's official API on 2026-10-15; setup-uv was added and resolved on 2026-10-17. CodeQL's annotated `v4` tag was resolved to its commit. Gitleaks 8.30.1 uses the Linux x64 archive SHA-256 published in its release checksums. Review upstream changes and updated hashes together.

| Action | Verified ref | Commit |
| --- | --- | --- |
| `actions/checkout` | `v7.0.1` | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | `v7.1.0` | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| `actions/upload-artifact` | `v7.0.2` | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |
| `actions/download-artifact` | `v8.0.2` | `9000827ccba6bdab643e8b6fd33ac0654aef8333` |
| `github/codeql-action` | `v4` | `6f2ac81f5cd81fe351a197ba0b00d91d03cd2aee` |
| `astral-sh/setup-uv` | `v10.3.0` | `1c37ad07a6a961277cf70c0d37d6f313000f5884` |

Resolve updates with `gh api repos/OWNER/REPO/commits/TAG --jq .sha`; inspect action inputs at that commit. Official verification endpoints: [checkout](https://api.github.com/repos/actions/checkout/commits/v7.0.1), [setup-node](https://api.github.com/repos/actions/setup-node/commits/v7.1.0), [upload-artifact](https://api.github.com/repos/actions/upload-artifact/commits/v7.0.2), [CodeQL](https://api.github.com/repos/github/codeql-action/commits/v4), and [Gitleaks release](https://api.github.com/repos/gitleaks/gitleaks/releases/tags/v8.30.1).

## Release gates and handoff

1. Finish FE work and review the diff. Open a PR against `main` when authorized. Configure branch protection/rulesets to require the quality, browser, full-history secret scan, production audit, and read-only CodeQL checks after their first successful runs; adding YAML alone does not configure protection. Fork workflows may need maintainer approval in Actions.
2. Review security reports and the Lighthouse summary on the PR. Investigate advisory loading warnings that are new or clearly worse than the previous run; they are signals, not merge blockers. Also verify initial JavaScript, responsive behavior and the full browser suite.
3. After the required checks pass, merge the reviewed PR. The connected Vercel project deploys `main` to production automatically. Verify the production revision, domain and routes, then check field Core Web Vitals in Vercel Speed Insights once real traffic has accumulated.

These workflows do not deploy the application. Production release follows the reviewed merge and Vercel verification steps above.

See [runtime baseline](ci-runtime-baseline.md) for observed historical timings and the still-pending Linux experiment. The owner-started [final review runbook](final-review-release.md) reuses exact-revision CI evidence and performs targeted actual-preview checks; it does not rerun the entire browser suite or configure an unattended merge service. CI/CD and Auth/RLS increments still require concrete owner approval before integration/application.

## Committed visual assets

Production builds verify committed visual assets instead of re-encoding AVIFs on the runner. This keeps the reviewed bytes stable between Windows, Linux CI and Vercel. After intentional source-artwork changes, run `npm run generate:assets` and inspect/commit the output. Generator tests compare each encoder's output with its source properties and check committed-mode byte preservation separately, avoiding false byte-equality assumptions across encoders.
