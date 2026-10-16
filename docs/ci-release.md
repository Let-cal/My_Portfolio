# CI and release flow

## Checks

PRs targeting `main` and pushes to `main` run:

- **CI:** Node.js 22, `npm ci`, ESLint, unit tests, production build, `tsc --noEmit` after Next.js generates route types, the existing 200 KB initial-JavaScript gate, and artifact/script budgets. A second job runs the complete Chromium suite with one worker. The existing Playwright config builds and starts the production server on port 3100; CI never reuses an existing server. The build occurs in each job so browser tests exercise their own clean install.
- **Mobile performance:** a separate isolated job uses the lockfile's Lighthouse version and Chromium to collect three mobile runs for each of EN/JA/VI. Independent medians must meet Performance ≥85, Accessibility ≥95, LCP ≤2500 ms, TBT ≤200 ms and CLS ≤0.1. Missing/invalid measurements fail the gate. It never turns off the site's normal motion or replaces the page with a benchmark-specific layout.
- **Security:** checksum-pinned Gitleaks CLI scans all fetched branches/tags and the PR merge history with default rules and redacted reports. Deleting a secret from the current tree does not clear its history finding. Production `npm audit --omit=dev --audit-level=high` fails on high/critical advisories or an audit-service error; it never runs `audit fix`.
- **CodeQL:** JavaScript/TypeScript with `security-extended` queries and no application build. PR jobs have read-only permissions, save SARIF for review, and fail on errors or security severity at least 7. Lower-severity findings still need review. Only the separate trusted `main` job can publish code-scanning results with `security-events: write`. A successful upload does not mean there are no alerts: review the Security tab before release. Avoid enabling a duplicate default-setup CodeQL workflow.
- **Dependabot:** weekly npm and GitHub Actions PRs, bounded to three and two open update PRs respectively. Minor/patch npm updates are grouped; major updates remain separate. Updates receive the same PR checks; no automatic merging is configured. The standalone Gitleaks binary/checksum needs a reviewed manual update.

Security and CodeQL also run weekly. Failure artifacts expire after three days. Playwright uploads its HTML report and `test-results`, including traces supplied by the existing first-retry trace setting. Unit failures upload JUnit output. Logs remain available in Actions when a command fails before a report exists.

## Cost and trust boundaries

- This setup targets the verified **public** `Let-cal/My_Portfolio` repository. Every job checks that the repository remains public, uses standard `ubuntu-24.04` runners, and has a timeout. No larger runners, paid scanner service, deployment job, Lighthouse server, or persistent hosting is provisioned. Reassess this setup before making the repository private.
- Workflow concurrency cancels superseded runs. npm caches contain downloaded packages only; no `.next`, browser binaries, `node_modules`, or PR artifacts are promoted into trusted jobs. Artifact retention is short to limit storage.
- Keep the account's Actions spending budget at $0 with over-budget usage blocked. Public runner compute is free, but cache/artifact storage still consumes GitHub quotas. This change does not modify billing settings; check the existing budget before enabling the workflows.
- Workflow permissions default to `contents: read`. Checkout does not retain credentials. PR code runs only under `pull_request`, never `pull_request_target` or a privileged `workflow_run`. No repository secret, PAT, Supabase credential, or Vercel token is required. The app uses its seed content in this environment.
- All external actions use full commit SHAs resolved through GitHub's official API on 2026-10-15. CodeQL's annotated `v4` tag was resolved to its commit. Gitleaks 8.30.1 uses the Linux x64 archive SHA-256 published in its release checksums. Review upstream changes and updated hashes together.

| Action | Verified ref | Commit |
| --- | --- | --- |
| `actions/checkout` | `v7.0.1` | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | `v7.1.0` | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| `actions/upload-artifact` | `v7.0.2` | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |
| `github/codeql-action` | `v4` | `6f2ac81f5cd81fe351a197ba0b00d91d03cd2aee` |

Resolve updates with `gh api repos/OWNER/REPO/commits/TAG --jq .sha`; inspect action inputs at that commit. Official verification endpoints: [checkout](https://api.github.com/repos/actions/checkout/commits/v7.0.1), [setup-node](https://api.github.com/repos/actions/setup-node/commits/v7.1.0), [upload-artifact](https://api.github.com/repos/actions/upload-artifact/commits/v7.0.2), [CodeQL](https://api.github.com/repos/github/codeql-action/commits/v4), and [Gitleaks release](https://api.github.com/repos/gitleaks/gitleaks/releases/tags/v8.30.1).

## Release gates and handoff

1. Finish FE work and review the diff. Open a PR against `main` when authorized. Configure branch protection/rulesets to require the quality, browser, full-history secret scan, production audit, and read-only CodeQL checks after their first successful runs; adding YAML alone does not configure protection. Fork workflows may need maintainer approval in Actions.
2. Review security reports and fresh production mobile Lighthouse results. The dedicated CI job enforces three-run independent medians per locale: Performance >=85, Accessibility >=95, LCP <=2500 ms, TBT <=200 ms, CLS <=0.1. Also verify initial JavaScript, responsive behavior and the full browser suite. TBT is a lab metric, not proof of field INP.
3. Current release measurements and remaining failures are recorded in the [FE checkpoint](fe-release-checkpoint.md) and plan ledger. Never lower thresholds, hide failures or infer release readiness from pipeline preparation. Production npm audit after removing the unused shadcn CLI reports zero vulnerabilities; development tooling still has upstream braces advisories without a published fixed version. Track that development risk separately, without suppressing the production gate.
4. After the required checks and performance gates pass, merge the reviewed PR when authorized. Then verify the intended Vercel project is on its free/Hobby arrangement and that only the intended `main` revision reaches production. These workflows do not invoke Vercel or change existing Git integration; an already-connected Vercel project may deploy automatically on merge. Verify the production revision, domain, routes, and mobile results before declaring release complete.

These workflows do not deploy the application. Production release follows the reviewed merge and Vercel verification steps above.
