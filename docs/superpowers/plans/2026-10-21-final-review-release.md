# Assisted Final Review and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace repeated owner checklist execution with reliable agent review while shortening existing CI and keeping hosted content read-only.

**Architecture:** Deliver three separately reviewable increments: existing CI measurement/optimization, disposable integration tests, then least-privilege preview access plus the release runbook. Reuse existing tests and workflows. Sensitive increments are prepared locally and reviewed before owner approval to push/apply them; a successful unit test never substitutes for a real integration run.

**Tech Stack:** Node.js 22, node:test, Playwright, GitHub Actions standard Linux runners, Next.js 16, local Supabase services, existing Supabase SSR/RLS.

**Spec:** `docs/superpowers/specs/2026-10-21-final-review-release-design.md`

## Global Constraints

- Keep services free. Add CI work only for a demonstrated coverage gap; optimize existing checks first rather than layering another complete suite onto them.
- Full CRUD runs against an ephemeral database in CI using synthetic data. Actual hosted previews share the production database and receive read-only application checks.
- A failed, skipped, or blocked mandatory check is not PASS. A retry that passes does not erase a flaky failure.
- No scheduled polling or unattended service is introduced.
- CI/CD and Auth/RLS changes need explicit approval of the concrete result before integration/application. Preparing local code/tests is authorized; do not push a modified workflow merely to obtain measurements before that approval.
- Do not bypass branch protection or create real Auth accounts. The owner provisions and logs into the dedicated hosted reviewer account.
- Preserve all public UI, animation, current regression coverage, current check names where possible, and current blocking/advisory thresholds.
- Never expose hosted secrets, auth state, raw authenticated traces or personal content in the public repository/artifacts. No attribution trailers.
- Leave the original checkout, its `.lcp-probe.tmp.mjs`, port 3000, other processes, and existing databases alone.

## Review Focus

1. A retry-only pass must remain visible and cannot authorize merge (Tasks 1, 2, 6).
2. An incomplete shard/report or moved PR head must not yield a green release decision (Tasks 1, 2, 6).
3. Browser sharding must preserve every existing veil/flicker assertion without competing GPU workers on one runner (Task 2).
4. A hosted URL or inherited production credential must never reach a fixture/reset operation (Task 4).
5. A reviewer must be denied mutations at both application and database layers, including direct requests (Task 5).

## Delivery boundaries

The initial branch is stacked on PR #15 (`9dfd3ed`) because its media implementation is needed by later integration checks. Do not merge or duplicate PR #15 implicitly. Before opening an implementation PR, either target its branch explicitly or rebase the isolated new commits onto `main` after #15 is merged; inspect the resulting diff. Keep optimization, integration, and authorization increments separate rather than shipping all through one sensitive PR.

The owner has already approved planning followed by implementation and previously chose subagent-driven execution. Do not request that decision again. Stop only at the named sensitive-operation approval gates or a genuine external prerequisite.

### Task 1: Reproducible Playwright timing and outcome report

**Files:** Create `.github/scripts/playwright-summary.mjs`, `tests/scripts/playwright-summary.test.mjs`; create `docs/ci-runtime-baseline.md`.

**Interfaces:** Export `summarizePlaywright(report)` returning `{ durationMs, counts: { expected, unexpected, flaky, skipped }, files, slowest, errors }`, where each file contains `file`, `durationMs`, `tests` and each slowest test contains `file`, `title`, `outcome`, `durationMs`, `attempts`. The CLI accepts exactly one JSON report path, emits a readable summary, and exits nonzero for invalid/incomplete reports, report errors, unexpected/flaky/skipped mandatory tests. Sum retry attempts for per-file runtime; distinguish summed test time from elapsed report duration. No API calls or merge side effects.

- [ ] Write node:test cases for nested suites, two projects, retry duration, flaky outcomes, skipped/interrupted tests, report errors, missing/zero tests, malformed/nonfinite durations, and disagreement with stats counts. Assert exports before calling them so the initial failure is meaningful.
- [ ] Run `node --test tests/scripts/playwright-summary.test.mjs`; observe RED because the feature does not exist.
- [ ] Implement a strict, dependency-free report reader; format untrusted titles/paths as plain text without terminal control characters. Avoid exporting raw attachments/error stacks. Add CLI tests using temporary synthetic reports, including nonzero exit on flaky/skipped/missing reports.
- [ ] Run targeted tests then `npm test` and `npm run test:budgets`. Record outputs. Read three existing successful CI logs and record run IDs, revisions, elapsed time, browser time, test counts and hotspot provenance; do not fabricate JSON reports for runs that only uploaded reports on failure.
- [ ] Commit `test(ci): add Playwright timing and outcome reporting`.

### Task 2: Prepare a two-runner browser candidate without losing regressions

**Files:** Modify `.github/workflows/ci.yml`, `tests/e2e/veil.spec.ts`, `docs/ci-release.md`, `.gitignore`; create `tests/scripts/browser-ci.test.mjs`.

**Interfaces:** Keep the required job name `Playwright Chromium on Linux` for a final aggregate job. Two internal matrix jobs use `shard: [1, 2]`, one Playwright worker per runner, `--shard=${{ matrix.shard }}/2`, `--fail-on-flaky-tests`, JSON and blob reports. Aggregate only the same run/attempt's expected two artifacts. Validate complete shard coverage before considering outcomes. Keep only synthetic reports in public artifacts with short retention. Task 1 is the report-summary API.

- [ ] Write failing configuration-contract tests for two shards, one worker, fail-on-flaky, preserved required aggregate check name, missing-shard rejection and no privileged workflow/token. Validate shard manifests against actual `playwright test --list --shard=1/2` / `2/2` IDs: union equals baseline, intersection empty.
- [ ] Observe RED, then implement the matrix candidate and a fail-closed aggregate job, still depending on quality. Keep Lighthouse/quality/security semantics unchanged. Do not add a duplicate full browser workflow or change protection. Use existing pinned action SHAs. Limit artifacts to the current workflow run/attempt and ensure aggregate fails when a shard was cancelled/failed/skipped.
- [ ] Make independent `veil.spec.ts` cases shardable while preserving all assertions, frame counts, live WebGL checks, viewport/theme cases, timeouts and scroll interactions. Retain one worker per runner. Do not reduce frame samples or disable the scene as an optimization.
- [ ] Run targeted configuration tests, shard discovery checks, formatting/lint/types, full unit/script suites, production build/budgets and the full browser suite on an owned non-3000 port. On Windows use actual local GPU configuration and explicitly distinguish it from Linux SwiftShader.
- [ ] Commit `ci: prepare two-shard browser checks with complete reports`. Prepare a concise local diff for owner approval before pushing a workflow change. The candidate is not declared faster until Task 3.

### Task 3: Approval and measured CI experiment

**Files:** Update `docs/ci-runtime-baseline.md`, `docs/ci-release.md` with actual results.

**Interfaces:** Consumes Tasks 1-2 commits and the owner's explicit approval of their concrete CI/CD diff. Produces a reviewed optimization PR and a measured keep/revert decision, not an estimated speed claim.

- [ ] Present the actual diff, local results, stable required-check mapping, unchanged gate thresholds, expected two-runner cost and residual Linux validation needs. Request approval to push/run the candidate; do not block unrelated local preparation in Tasks 4/6 while waiting.
- [ ] After approval, push only the intended increment, attach its PR, and run three successful representative candidate trials. Include queue/setup/build times and summed runner usage; investigate any flaky or missing report before counting a trial successful.
- [ ] Compare with three baseline runs. Retain only an improvement with preserved coverage/stability; otherwise keep the baseline and document the failed experiment. Recheck exact PR revision and owner-sensitive merge approval before integration.
- [ ] Commit measured results. Do not merge #15 or this CI PR under ordinary-PR authority.

### Task 4: Disposable Supabase integration environment

**Files:** Create `supabase/config.toml`, `scripts/ci/local-supabase.mjs`, `scripts/ci/seed-admin.mjs`, `playwright.admin.config.ts`, `tests/scripts/local-supabase.test.mjs`, `tests/e2e-admin/admin-flows.spec.ts`, `tests/e2e-admin/fixtures.ts`; modify `docs/ci-release.md` and, after approval, existing `ci.yml` for missing coverage only.

**Interfaces:** `assertLocalSupabase(url)` accepts only explicit loopback HTTP Supabase URLs and rejects all hosted/ambiguous destinations. The launcher creates a fresh owned environment and application process; the fixture setup uses local-only admin keys and emits synthetic user credentials solely to the local test process. Public tests remain separate from authenticated fixtures; no production-linked CLI reset or migration application.

- [ ] Add failing safety tests for the hosted project URL, lookalike hosts, userinfo, nonloopback IPs, alternate schemes, empty values and inherited hosted credentials. Add the positive loopback cases. Observe RED, implement the guard, run GREEN.
- [ ] Discover/pin an official CLI version, verify local service config options and migration ordering from current docs/help. Replay committed migrations on an empty local DB. Do not rewrite deployed migration history or replay the existing Storage policy on hosted Supabase.
- [ ] Seed local full-admin and ordinary authenticated identities with representative synthetic content. Browser-test login, create/edit/order/visibility, draft retention, cross-tab signout and conflict, media upload/picker/reference/delete protection, and signout. Use genuine local services; label simulated network faults as simulation.
- [ ] Run service integration and actual browser tests only with Docker available. This machine currently lacks Docker; do not silently substitute mocked tests or install/start a system-wide service. Prepare the concrete Linux CI change for approval and mark real service verification BLOCKED until that run occurs.
- [ ] Run full unit/script/build checks for changes that can be verified locally; commit `test(admin): add isolated Supabase integration coverage`. Owner approval precedes workflow publication/application.

### Task 5: Read-only preview authorization, separate security increment

**Files:** Create `src/lib/admin/access.ts`, `src/components/admin/ReadOnlyNotice.tsx`, dedicated access tests under `tests/unit/`, and a CLI-generated migration plus verification/rollback SQL under `supabase/migrations/` and `docs/`; modify proxy guard, admin layout/pages/read actions and persistent UI controls only where necessary.

**Interfaces:** `getAdminAccess()` resolves `{ kind: 'admin' | 'reviewer', email } | null` from authenticated user and trusted server configuration. Existing `requireAdmin()` remains full-admin-only for every mutation. `requireContentRead()` permits only approved content reads. Reviewer entry is preview-only at the app layer. DB allowlist is exactly `profile`, `roles`, `experiences`, `projects`, `skills`, `skill_links`, `certificates`, `activities`, `education`, `why_cards` and object metadata in buckets `media`/`files`; explicitly exclude private admin membership, audit/version payloads and Auth administration. Owner approval must include this shared-backend read scope.

- [ ] Read current Supabase docs and Next.js installed guides. Write RED tests for the admin/reviewer/nonadmin/anonymous matrix, production rejection, editable metadata/header bypass attempts, direct mutation rejection, and immediate membership revocation. Use a private UID allowlist, not editable user metadata or the full-admin email allowlist.
- [ ] Implement read/mutation separation and read-only UI indication. Existing admin behavior must remain unchanged. Inspect read-triggered side effects; do not mint draft-mode cookies or perform writes just to browse the reviewer UI. Explicitly deny access to pages requiring excluded private data rather than broadening the allowlist.
- [ ] Generate and verify the migration with the CLI's supported workflow; do not invent timestamp conventions. Add local RLS tests for SELECT scope and denial of INSERT/UPDATE/DELETE/Storage mutations and excluded reads using Task 4's actual local services.
- [ ] Produce exact rollout/rollback/verification SQL, advisor evidence, credential/session handling and residual shared-DB limitation. Prepare the code and tests for separate owner approval. The owner provisions the hosted account and logs in; no password/session export to CI.
- [ ] Commit `feat(admin): prepare preview read-only reviewer access`. Do not apply hosted migrations or merge without explicit concrete security approval. After approved rollout, verify actual preview reads and production app rejection without submitting hosted write probes.

### Task 6: Revision-bound release decision and runbook

**Files:** Create `.github/scripts/review-release.mjs`, `tests/scripts/review-release.test.mjs`, `docs/final-review-release.md`; update `.github/pull_request_template.md` only with concise links/checklist guidance.

**Interfaces:** Export `evaluateRelease(evidence)` -> `{ decision: 'PASS' | 'FAIL' | 'BLOCKED', reasons: string[] }`. Evidence includes reviewed/current head and base SHAs, immutable deployment SHA, required checks with statuses, preview checklist results, independent review findings, flaky state and sensitive-scope approval. This is a conservative assistant decision helper, never a credentialed auto-merge service; all changes to checks/rules still need approval.

- [ ] Write RED tests for changed head/base/deployment, missing or skipped check, retry-only pass, missing authenticated preview evidence, unresolved important findings and absent sensitive approval; assert no output authorizes merge. A complete ordinary sample yields PASS. Empty or malformed evidence fails closed.
- [ ] Implement the pure evaluator and CLI without shell execution/network/secrets. Run targeted, full unit and script suites.
- [ ] Write the agent runbook: owner command -> diff/classification -> reuse exact-revision CI -> permitted preview baseline/changed checks -> independent review -> sanitized maintained report -> revalidation -> SHA-bound merge respecting protection -> Vercel revision/canonical/locale/metadata/CV smoke checks. Record merge/deploy/verify separately. Failed production prompts a concrete rollback approval; no automatic DB rollback.
- [ ] Demonstrate PASS/FAIL/BLOCKED/stale evidence with synthetic inputs. A live release demonstration remains BLOCKED until Tasks 3-5 prerequisites and a suitable authorized PR exist; do not merge #15 as a demonstration.
- [ ] Commit `feat(review): add conservative release evidence gate and runbook`.

## Verification and handoff

Each task has a fresh spec/quality review, and each deliverable increment has a whole-branch review. Record RED/GREEN commands, exact counts, commits, rulings and blocked prerequisites in this plan's isolated ledger. Resolve important findings with regression tests before seeking owner approval of the concrete sensitive change. Never describe pending Linux/Docker/hosted verification as passing.

No paid service, new production data, account, credential or scheduled automation is created by executing local preparation. At the first sensitive publication/application gate, provide the actual diff, evidence and one concise approval request; preserve remaining work and continue independent safe local tasks.
