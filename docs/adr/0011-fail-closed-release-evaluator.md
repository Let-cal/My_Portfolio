# ADR-0011: A fail-closed evaluator for preview review evidence

- Status: Accepted
- Date: 2026-10-22
- Introduced in: [PR #16](https://github.com/Let-cal/My_Portfolio/pull/16); version 2 in [PR #19](https://github.com/Let-cal/My_Portfolio/pull/19)

## Context

Release review of a PR collects evidence from several places: required checks, retries, the Vercel preview, manual checks across devices, locales and themes, an independent code review and, for sensitive changes, the owner's approval. A green dashboard can still hide a skipped check, a retry that masked a failure, evidence from an older head, or a preview built from a different commit. Preview deployments share the production database, so signed-in checks must stay read-only.

## Decision

- `.github/scripts/review-release.mjs` is a pure, dependency-free evaluator with a local JSON CLI. It has no network client, shell, credentials, merge or deployment operation.
- It returns `PASS`, `FAIL` or `BLOCKED`. FAIL wins over BLOCKED; both stop the release. The CLI exits 0 only for PASS, and callers must check both the exit code and the `decision` field.
- Fail-closed rules (evidence contract v1 in [docs/final-review-release.md](../final-review-release.md)):
  - every head/base SHA in the bundle must agree with the current PR; a new head or base invalidates evidence;
  - the check inventory must be complete; every inventoried check needs a result, and an unclassified check is BLOCKED;
  - flaky results and failed earlier attempts FAIL, even when a retry passed;
  - times are epoch milliseconds, ages are bounded (at most 24 hours), and future times FAIL;
  - the baseline matrix (desktop, mobile, EN/JA/VI, light/dark, keyboard, reduced motion) is mandatory;
  - a mutable branch-alias URL needs recorded verification, before and after the signed-in checks, that it served the reviewed SHA's deployment;
  - unresolved important or critical review findings FAIL; sensitive changes without explicit owner approval are BLOCKED.
- Reasons are fixed labels; the tool never echoes submitted URLs or text.
- The runbook keeps authority with people: only an agent explicitly started by the owner for a named PR may merge, with a merge bound to the reviewed head SHA, and production is reported as **merged**, **deployed** and **verified** separately.

## Consequences

Positive:

- Missing or stale evidence stops a release instead of passing by omission.
- The rules are executable and tested; the runbook is not the only definition.
- Version 2 added the complete check inventory, the baseline matrix, verified branch aliases, millisecond timestamps and bounded ages (commits `3a6f313`, `22c81bb`).

Negative / trade-offs:

- The evaluator **cannot verify authenticity**. Internally consistent fabricated JSON returns PASS. The trusted part is the owner-started agent that collects evidence from GitHub and Vercel.
- A PASS grants no merge authority on its own.
- The contract is strict and verbose; collecting a complete bundle takes effort for each PR.

## Evidence

- Evaluator: [.github/scripts/review-release.mjs](../../.github/scripts/review-release.mjs)
- Tests: [tests/scripts/review-release.test.mjs](../../tests/scripts/review-release.test.mjs) (including CLI demonstrations: PASS, missing check BLOCKED, changed head FAIL)
- Runbook and contract: [docs/final-review-release.md](../final-review-release.md)
- Design and plan: [spec](../superpowers/specs/2026-10-21-final-review-release-design.md), [plan](../superpowers/plans/2026-10-21-final-review-release.md), [2026-10-25 decisions](../superpowers/specs/2026-10-25-continuation-design.md)
- PR template link: [.github/pull_request_template.md](../../.github/pull_request_template.md)
