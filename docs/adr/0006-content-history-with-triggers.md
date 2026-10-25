# ADR-0006: Content history through database triggers; restore is admin-only

- Status: Accepted
- Date: 2026-10-20
- Introduced in: [PR #12](https://github.com/Let-cal/My_Portfolio/pull/12)

## Context

The admin needed undo for deletes and a way to see and restore earlier versions of an item. History written by the app would miss any change that does not go through a server action, and a failed second write could leave a change without a record.

## Decision

- `private.content_versions` stores the old row as `jsonb` for every update or delete, with table, item key, operation, the editor's JWT email, time and transaction ID (`20261020074656_content_versions.sql`).
- An `after update or delete` trigger on each of the 10 content tables calls `private.record_version()`:
  - changes to `sort_index` or `updated_at` only are not versions;
  - each item keeps its newest 50 versions.
- The table sits in the `private` schema with RLS on and all grants revoked from `public`, `anon` and `authenticated`.
- `public.admin_list_versions` and `public.admin_restore_version` check `private.is_admin()` and raise `42501` otherwise.
- A restore writes the old row back with an upsert, never delete-and-insert, so the restore is itself a new version and can be undone. Restoring a delete also restores the skill links deleted in the same transaction when both ends still exist.
- Follow-up `20261020074657_versions_security_invoker.sql` (Supabase lint 0029): both functions now run as `security invoker`, and a `content_versions_admin_read` policy grants SELECT to the admin only. Restores therefore also pass the normal table write policies.
- Both migrations are additive and list their rollback statements in the file header.

## Consequences

Positive:

- History covers every write path, including direct SQL, because the database records it.
- History and change commit or roll back together in one transaction.
- Only the admin can read history or restore; a signed-in non-admin gets a permission error.
- `supabase/checks/content-versions-check.sql` prints PASS or names what failed.

Negative / trade-offs:

- History stores the editor's email in `changed_by`. That matters for any future read access to history (see [ADR-0013](0013-read-only-reviewer-role.md)).
- 50 versions per item is a fixed limit; older versions are deleted.
- Reorders are not versions, so a restored edit keeps the item's current position.
- Storage files are not versioned. Deleting a file cannot be undone through history.

## Evidence

- Migrations: [20261020074656_content_versions.sql](../../supabase/migrations/20261020074656_content_versions.sql), [20261020074657_versions_security_invoker.sql](../../supabase/migrations/20261020074657_versions_security_invoker.sql), [20261019155349_updated_at_ignores_order.sql](../../supabase/migrations/20261019155349_updated_at_ignores_order.sql)
- Check script: [supabase/checks/content-versions-check.sql](../../supabase/checks/content-versions-check.sql)
- App: [src/lib/admin/versions.ts](../../src/lib/admin/versions.ts), history actions in [src/app/admin/actions.ts](../../src/app/admin/actions.ts)
- Tests: [tests/unit/admin-versions.test.ts](../../tests/unit/admin-versions.test.ts), [tests/unit/version-history.test.tsx](../../tests/unit/version-history.test.tsx), [tests/unit/db-schema.test.ts](../../tests/unit/db-schema.test.ts)
- Plan: [docs/superpowers/plans/2026-10-20-admin-ux-batch3.md](../superpowers/plans/2026-10-20-admin-ux-batch3.md)
