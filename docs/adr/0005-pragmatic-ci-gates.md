# ADR-0005: Block on stable signals; report lab loading metrics as advisory

- Status: Accepted
- Date: 2026-10-19
- Introduced in: [PR #1](https://github.com/Let-cal/My_Portfolio/pull/1) (commit `65fccbb`); later CI work in [PR #11](https://github.com/Let-cal/My_Portfolio/pull/11) and [PR #16](https://github.com/Let-cal/My_Portfolio/pull/16)

## Context

Lighthouse lab results on shared GitHub runners vary between runs. A hard performance threshold kept the mobile job flipping on unchanged code (commit `65fccbb` message). A gate that fails at random teaches people to rerun until green, which hides real regressions. Other signals are deterministic and should block.

## Decision

- **Blocking** (the job fails):
  - Prettier, ESLint, generated-file check, Vitest, production build, `tsc --noEmit`;
  - initial JavaScript ≤200 KB gzip (`scripts/measure-initial-js.mjs`);
  - artifact and script budget tests (`npm run test:budgets`);
  - the full Playwright Chromium suite, with `--fail-on-flaky-tests` and an aggregate job that rejects missing, duplicated, skipped or flaky results;
  - Lighthouse mobile medians: Accessibility ≥95, SEO ≥90, CLS ≤0.1;
  - Gitleaks over full history, production `npm audit` (high and critical), CodeQL (errors or security severity ≥7).
- **Advisory** (warning and job summary row, no failure): Lighthouse Performance ≥85, LCP ≤2500 ms, TBT ≤200 ms.
- Lighthouse runs three times per locale (EN/JA/VI) and judges the median of each metric. The thresholds live in one place, `scripts/performance-budgets.mjs` (`BLOCKING` and `ADVISORY`).
- Real-user Core Web Vitals come from Vercel Speed Insights in production.
- Locally, a pre-push hook runs `npm run verify:quick`; `npm run verify` runs the same checks as the quality job.

## Consequences

Positive:

- A failing gate points at a change in the code, not at runner noise.
- Accessibility and SEO, which matter for a public portfolio and are stable in lab runs, cannot regress silently.
- Loading metrics are still visible on every PR.

Negative / trade-offs:

- A performance regression can merge if only advisory metrics move. Reviewers must read the Lighthouse summary; the release steps in `docs/ci-release.md` ask them to.
- Three runs per locale add CI time.
- Field data needs real traffic before it says anything.

## Evidence

- Thresholds: [scripts/performance-budgets.mjs](../../scripts/performance-budgets.mjs), test [tests/scripts/performance-budgets.test.mjs](../../tests/scripts/performance-budgets.test.mjs)
- Workflow: `performance`, `quality`, `browser-shards` and `browser` jobs in [.github/workflows/ci.yml](../../.github/workflows/ci.yml); [security.yml](../../.github/workflows/security.yml); [codeql.yml](../../.github/workflows/codeql.yml)
- Browser completeness check: [.github/scripts/merge-browser-reports.mjs](../../.github/scripts/merge-browser-reports.mjs)
- Procedure: [docs/ci-release.md](../ci-release.md), [docs/ci-runtime-baseline.md](../ci-runtime-baseline.md)
- Local hooks: [.husky/pre-push](../../.husky/pre-push), scripts in [package.json](../../package.json)
