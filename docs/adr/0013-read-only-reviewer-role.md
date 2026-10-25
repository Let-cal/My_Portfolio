# ADR-0013: A read-only reviewer role for signed-in preview checks

- Status: Accepted ([PR #20](https://github.com/Let-cal/My_Portfolio/pull/20))
- Date: 2026-10-25

## Context

Release review of admin changes needs signed-in checks on the Vercel preview ([ADR-0011](0011-fail-closed-release-evaluator.md)). Previews share the production database, so one wrong save during review would change real content. Review must never use the owner's full-admin account.

## Decision


- **Identity.** A UID allowlist `private.app_reviewers` (primary key referencing `auth.users`, cascade on delete) and `private.is_reviewer()`, which checks `auth.uid()`. The schema is not exposed by the Data API. Email, user metadata and request headers are never trusted. The allowlist and function follow the same pattern as `private.app_admins` and `private.is_admin()` ([ADR-0004](0004-rls-as-the-final-guard.md)).
- **Database, the last guard.** The reviewer gets only `for select` policies:
  - the 10 content tables, including hidden rows;
  - object listing in the `media` and `files` buckets;
  - `private.content_versions`, through `admin_list_versions`;
  - receiving `admin:content` change notes.
  No insert, update or delete policy or grant exists for the role. `admin_restore_version` still checks `private.is_admin()` only.
- **Server.** Read-only actions (history, media listing, session check) accept admin or reviewer. Every mutation keeps `requireAdmin()`, so a reviewer calling an action directly gets `FORBIDDEN` before any database call.
- **Proxy.** `/admin/**` admits the admin or the reviewer, decided by a `security invoker` function `public.admin_access_kind()`. A lookup error means no access.
- **Interface.** A permanent read-only notice; forms in a disabled fieldset with no save bar and no drafts; toggles, reorder, duplicate, delete, upload and restore removed. This is a convenience; the server and database are the guarantee.
- **Draft preview** of hidden content stays admin-only ([ADR-0009](0009-draft-preview-outside-the-public-cache.md)).
- **Account handling.** A dedicated reviewer account. The owner signs it in once per PR in the app's browser; credentials and cookies never go to CI, reports or chat. No identifiers are committed.

## Consequences

Positive:

- Write denial does not depend on the UI: it holds at the action and RLS layers.
- Revocation is one `delete` from the allowlist; pages, actions and the Data API refuse the reviewer on the next request.
- Reviewer reads, write denials and revocation are tested against the disposable database in CI ([ADR-0010](0010-disposable-supabase-integration-tests.md)), not against hosted data.

Negative / trade-offs (recorded in the PR's security note):

- The reviewer can read real content, including hidden items, on preview and production, because both use one database.
- Version history includes the editor's email in `changed_by`.
- A Realtime channel that is already open keeps receiving change notes (table, operation, key) until it rejoins or its token refreshes, about an hour at most. For an immediate cut-off, also sign the reviewer out.
- Rolling back only the code is not enough: the session could still read through the Data API, Storage and Realtime. Revoke the allowlist row or roll back the database too.
- `admin_list_versions` is replaced rather than only added to, so its rollback restores the admin-only body.

## Evidence

- Pull request: [PR #20](https://github.com/Let-cal/My_Portfolio/pull/20).
- Migration: [`20261025103300_reviewer_read_only.sql`](../../supabase/migrations/20261025103300_reviewer_read_only.sql). Security note: [`reviewer-access.md`](../security/reviewer-access.md) (access matrix, guards, residual risks, rollout, revoke and rollback SQL).
- Code: [`access-core.ts`](../../src/lib/admin/access-core.ts), [`guard.ts`](../../src/lib/admin/guard.ts), [`AdminAccessProvider.tsx`](../../src/components/admin/AdminAccessProvider.tsx). Tests: [`admin-access.test.ts`](../../tests/unit/admin-access.test.ts), [`admin-read-only.test.tsx`](../../tests/unit/admin-read-only.test.tsx); real-backend reviewer checks in [`verify-admin-backend.mjs`](../../scripts/ci/verify-admin-backend.mjs).
- The owner approved the change; the migration was applied to the hosted project on 2026-10-25 under that version, and the dedicated account was added to the allowlist the same day.
- Decisions behind the design: section 3 of [docs/superpowers/specs/2026-10-25-continuation-design.md](../superpowers/specs/2026-10-25-continuation-design.md) (in Vietnamese).
