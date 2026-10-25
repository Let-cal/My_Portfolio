# ADR-0008: Media library on Supabase Storage with admin-only listing

- Status: Accepted
- Date: 2026-10-21
- Introduced in: [PR #15](https://github.com/Let-cal/My_Portfolio/pull/15)

## Context

Upload fields already wrote images, videos and PDFs to the public `media` and `files` buckets, but there was no way to reuse an existing file or to find files that no content uses. Listing needs a SELECT policy on `storage.objects`. A public one would reveal every file name, including files for hidden items. Preview and production share one database, so the change had to be additive.

## Decision

- `/admin/media` lists both buckets through the signed-in admin session, including nested folders and paginated objects (`src/lib/admin/media.ts`).
- One additive migration adds `admin_media_select`: SELECT on `storage.objects` for `authenticated`, only for `media`/`files` and only when `private.is_admin()` is true. Buckets and other policies stay as they were.
- Files stay publicly readable by URL, as before. Only listing is restricted.
- References are computed against current saved content, including hidden items. A failed or oversized inventory is an error, never a partial "unused" list.
- Upload fields gain a picker that only changes the unsaved form value; the form must be saved to publish the choice.
- Delete is offered only for unused files. The server calls `requireAdmin()`, re-reads every current reference and removes exactly the requested key; it refuses used files, invalid paths and other buckets.
- The rollout was documented as a checklist: read-only policy snapshot, apply, re-verify, test admin/non-admin/anonymous listing, and compare the security advisor before and after. A separate rollback file drops only the added policy.

## Consequences

Positive:

- Anonymous and non-admin sessions cannot enumerate the buckets.
- Unused-file detection does not miss files used by hidden content.
- The rollback removes one policy and touches no files or content.

Negative / trade-offs:

- A denied listing can look like an empty list; the checklist warns that an empty grid does not prove the policy exists.
- Deletion is permanent. Content history and local drafts may still reference a deleted file.
- Reference check and removal are not one atomic lock across tabs: a save in another tab between the two can still race.
- The usage indicator compares known bytes in two buckets with a 1 GB reference; it is not the billing quota.

## Evidence

- Migration: [supabase/migrations/20261021141852_admin_media_select.sql](../../supabase/migrations/20261021141852_admin_media_select.sql); verification and rollback SQL: [docs/admin-media-storage.sql](../admin-media-storage.sql), [docs/admin-media-storage-rollback.sql](../admin-media-storage-rollback.sql)
- Operations guide: [docs/admin-media-library.md](../admin-media-library.md); hosted application record: [docs/admin-media-verification-2026-10-21.md](../admin-media-verification-2026-10-21.md)
- Code: [src/lib/admin/media.ts](../../src/lib/admin/media.ts), [src/app/admin/media-actions.ts](../../src/app/admin/media-actions.ts)
- Tests: [tests/unit/admin-media-policy.test.ts](../../tests/unit/admin-media-policy.test.ts), [tests/unit/admin-media-actions.test.ts](../../tests/unit/admin-media-actions.test.ts), [tests/unit/admin-media-references.test.ts](../../tests/unit/admin-media-references.test.ts), [tests/unit/admin-media-picker.test.tsx](../../tests/unit/admin-media-picker.test.tsx)
