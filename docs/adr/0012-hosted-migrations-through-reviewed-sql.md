# ADR-0012: Hosted migrations go through reviewed SQL; file names match the hosted history

- Status: Accepted
- Date: 2026-10-25
- Introduced in: [PR #15](https://github.com/Let-cal/My_Portfolio/pull/15) (commit `85ca1a2`)
- Updated: 2026-10-25, history reconciled (see below)

## Context

- Preview deployments and production share one hosted Supabase database. A migration is a production change the moment it runs.
- The early migrations were written as `0001`–`0006` files and applied to the hosted project through reviewed SQL. The hosted migration history records its own timestamp versions, so the two histories do not match.
- `supabase db push` decides what to apply by comparing the local and hosted histories, so against this project it would treat migrations that are already applied as pending.
- The media migration showed the same drift: the file was created as `20261021124334`, while the hosted history recorded `20261021141852` ([verification record](../admin-media-verification-2026-10-21.md)).

## Decision

- Migrations after the initial schema (`0003` onward) are additive and state their rollback in the file header or a companion rollback file.
- A hosted migration is applied only after the owner approves the concrete SQL, followed by read-only verification and a security advisor comparison. The record goes in the PR or a dated verification document.
- From the media migration on, the file is named after the version the hosted history records (`20261021141852_admin_media_select.sql`), so both histories agree for new migrations.
- Every migration file is named after the version the hosted history records, so `supabase migration list` shows the two histories in agreement.
- A new project may still apply `supabase/migrations/` in order. The disposable CI stack does exactly that on every run ([ADR-0010](0010-disposable-supabase-integration-tests.md)).

## Consequences

Positive:

- No migration reaches the shared database without review, rollback SQL and a verification record.
- The committed migrations are still proven to apply cleanly from zero, in CI.
- New migrations no longer add to the drift.

Negative / trade-offs:

- Applying migrations is a manual, owner-gated step, not part of the deploy.
- Renaming a file to the hosted version means the file name reflects when it was applied, not when it was written.

## Reconciliation (2026-10-25)

- The executable SQL of the early `0001`–`0006` files was compared with the statements the hosted history stores: it is identical, and only comments and blank lines differed.
- The six files were renamed to the hosted versions (for example `0001_init.sql` became `20261018185208_init.sql`).
- `0004` (content history) had been applied through the SQL editor, so the hosted history had no row for it although all its objects exist. With the owner's approval, a history row was added as `20261020074656`, one second before `0005`, which depends on it. That version is reconstructed, not the original apply time.
- The README no longer warns against `supabase db push`; owner approval of the concrete SQL still applies.

## Evidence

- Rename commit `85ca1a2` and [docs/admin-media-verification-2026-10-21.md](../admin-media-verification-2026-10-21.md)
- Migrations and rollback notes: [supabase/migrations/](../../supabase/migrations), [docs/admin-media-storage-rollback.sql](../admin-media-storage-rollback.sql)
- Migration replay check: the `migrations` phase of [scripts/ci/run-admin-integration.mjs](../../scripts/ci/run-admin-integration.mjs) compares the replayed history with the committed files
