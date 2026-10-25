# ADR-0010: Test Auth, RLS, Storage and Realtime against a disposable local Supabase in CI

- Status: Accepted
- Date: 2026-10-22
- Introduced in: [PR #18](https://github.com/Let-cal/My_Portfolio/pull/18)

## Context

Unit tests mock Supabase, and the public browser suite runs on seed content. Neither proves that a non-admin is actually refused by RLS, that private Realtime rejects anonymous users, or that the signed-in admin flows work end to end. The hosted project is not a test target: preview and production share its database, and a CI job holding its credentials would be a much larger risk.

## Decision

- A separate CI job, **Disposable admin Auth, CRUD and RLS**, starts a fresh local Supabase stack with Docker on a standard `ubuntu-24.04` runner, replays every committed migration on an empty database, and tests against it (`scripts/ci/run-admin-integration.mjs`).
- No hosted URL, key or secret is used. The job starts Node through `env -i` with only public run identifiers; the launcher refuses inherited backend settings and non-GitHub-hosted workers.
- Guards before any data is written:
  - API and database URLs must be explicit loopback origins (`assertLocalSupabase`, `assertLocalDatabaseUrl` in `scripts/ci/local-supabase.mjs`);
  - a random project namespace, an empty pre-start Docker inventory, an owned loopback-only bridge network, and post-start checks that every published port binds to `127.0.0.1`;
  - the replayed migration history must match the committed migration versions.
- Only synthetic `@example.invalid` identities and content are provisioned. The local service-role key is confined to fixture provisioning; the app and browser get the anonymous key only.
- Real backend probes: admin and member sign-in, hidden-row denial, write denial on readable rows with full-row integrity checks, private schema/history/Storage denials with admin success controls, and private Realtime rejection for anonymous and member sessions plus admin delivery.
- Six browser scenarios run against a production build: login/logout and denial, certificate CRUD and ordering, drafts, two-tab Realtime, cross-tab sign-out with reauthentication, and offline recovery. One worker, zero retries; the reporter requires exactly these six scenarios.
- Only a sanitized JSON summary is uploaded (three-day retention). Raw logs, DOM, traces and passwords stay on the discarded runner.

## Consequences

Positive:

- RLS and Realtime authorization are tested against real Postgres and Realtime services, not mocks.
- Every migration is replayed from zero on each run, so a migration that does not apply cleanly fails the job.
- Hosted content is never written by tests; hosted previews stay read-only.

Negative / trade-offs:

- The job adds runner time and Docker image pulls; no speed-up is claimed.
- The admin browser uses the runner's preinstalled Chrome, not the public suite's pinned Chromium.
- Offline networking is simulated in the browser.
- It does not appear in the branch-protection list recorded in [docs/repository-maintenance.md](../repository-maintenance.md); see the README's CI gate table for the current state.
- The first approved Linux trial failed during backend probes. The failures were investigated rather than retried away, and the final run recorded in the PR description passed before merge ([trial record](../admin-integration-linux-trial-2026-10-24.md), [PR #18](https://github.com/Let-cal/My_Portfolio/pull/18)).

## Evidence

- Workflow: `admin-integration` job in [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- Scripts: [scripts/ci/](../../scripts/ci) (`run-admin-integration.mjs`, `local-supabase.mjs`, `disposable-runtime.mjs`, `verify-admin-backend.mjs`, `seed-admin.mjs`, `admin-reporter.mjs`)
- Browser scenarios: [tests/e2e-admin/admin-flows.spec.ts](../../tests/e2e-admin/admin-flows.spec.ts), config [playwright.admin.config.ts](../../playwright.admin.config.ts)
- Guard tests: [tests/scripts/local-supabase.test.mjs](../../tests/scripts/local-supabase.test.mjs), [disposable-runtime.test.mjs](../../tests/scripts/disposable-runtime.test.mjs), [disposable-launcher.test.mjs](../../tests/scripts/disposable-launcher.test.mjs), [backend-denial.test.mjs](../../tests/scripts/backend-denial.test.mjs), [admin-reporter.test.mjs](../../tests/scripts/admin-reporter.test.mjs)
- Contract and records: [docs/local-admin-integration.md](../local-admin-integration.md), [docs/admin-integration-verification-2026-10-24.md](../admin-integration-verification-2026-10-24.md)
