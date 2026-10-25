# ADR-0012: Hosted migrations go through reviewed SQL; no `supabase db push` until history is reconciled

- Status: Accepted
- Date: 2026-10-25
- Introduced in: [PR #15](https://github.com/Let-cal/My_Portfolio/pull/15) (commit `85ca1a2`)

## Context

- Preview deployments and production share one hosted Supabase database. A migration is a production change the moment it runs.
- The early migrations were written as `0001`–`0006` files and applied to the hosted project through reviewed SQL. The hosted migration history records its own timestamp versions, so the two histories do not match.
- `supabase db push` decides what to apply by comparing the local and hosted histories, so against this project it would treat migrations that are already applied as pending.
- The media migration showed the same drift: the file was created as `20261021124334`, while the hosted history recorded `20261021141852` ([verification record](../admin-media-verification-2026-10-21.md)).

## Decision

- Migrations after the initial schema (`0003` onward) are additive and state their rollback in the file header or a companion rollback file.
- A hosted migration is applied only after the owner approves the concrete SQL, followed by read-only verification and a security advisor comparison. The record goes in the PR or a dated verification document.
- From the media migration on, the file is named after the version the hosted history records (`20261021141852_admin_media_select.sql`), so both histories agree for new migrations.
- The README and the verification record warn: do not run `supabase db push` against the existing project until the history of `0001`–`0006` is reconciled. Reconciliation is a separate, approved follow-up.
- A new project may still apply `supabase/migrations/` in order. The disposable CI stack does exactly that on every run ([ADR-0010](0010-disposable-supabase-integration-tests.md)).

## Consequences

Positive:

- No migration reaches the shared database without review, rollback SQL and a verification record.
- The committed migrations are still proven to apply cleanly from zero, in CI.
- New migrations no longer add to the drift.

Negative / trade-offs:

- Until reconciliation, the hosted history and the repository disagree for `0001`–`0006`, and the standard CLI push workflow is unavailable for this project.
- Applying migrations is a manual, owner-gated step, not part of the deploy.
- Renaming a file to the hosted version means the file name reflects when it was applied, not when it was written.

## Evidence

- README warning: "Database and admin (optional)", step 1, in [README.md](../../README.md)
- Rename commit `85ca1a2` and [docs/admin-media-verification-2026-10-21.md](../admin-media-verification-2026-10-21.md)
- Migrations and rollback notes: [supabase/migrations/](../../supabase/migrations), [docs/admin-media-storage-rollback.sql](../admin-media-storage-rollback.sql)
- Migration replay check: the `migrations` phase of [scripts/ci/run-admin-integration.mjs](../../scripts/ci/run-admin-integration.mjs) compares the replayed history with the committed files
