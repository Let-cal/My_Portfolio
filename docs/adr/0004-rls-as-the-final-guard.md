# ADR-0004: Row level security is the final guard; the admin allowlist is private

- Status: Accepted
- Date: 2026-10-19
- Introduced in: [PR #6](https://github.com/Let-cal/My_Portfolio/pull/6)

## Context

Visitors read content with the publishable key, which ships to every browser. The admin edits through server actions and uploads files straight from the browser to Storage. Any check that runs only in the Next.js app can be skipped by calling the Supabase Data API directly with a valid session, so the database itself has to decide who may write.

## Decision

- Every content table has RLS enabled (`supabase/migrations/20261018185208_init.sql`):
  - read: all rows for `anon` and `authenticated`; on `experiences`, `projects` and `certificates`, only `published` rows unless the caller is the admin;
  - write: `for all to authenticated` with `private.is_admin()` in both `using` and `with check`.
- Storage `media` and `files` buckets are publicly readable; insert, update and delete require `private.is_admin()`.
- The allowlist `private.app_admins` and `private.is_admin()` live in the `private` schema (`20261018185337_private_admin.sql`). The Data API exposes only `public` and `graphql_public` (`supabase/config.toml`), and the table grants nothing to `anon` or `authenticated`.
- `is_admin()` is `security definer` with an empty `search_path`, so it can read the allowlist without exposing it.
- App-level checks are defense in depth, not the boundary:
  1. the proxy (`src/proxy.ts` → `adminGuard`) sends anyone except the configured `ADMIN_EMAIL` from `/admin` to login;
  2. every server action calls `requireAdmin()` first and returns `SESSION_EXPIRED` or `FORBIDDEN`.
- The proxy lets server-action POSTs through so a redirect cannot destroy an open form; `requireAdmin()` and RLS answer those requests.
- Columns are described once in `src/lib/data/columns.ts`; `supabase/schema.sql` and the SQL are generated from it and tests compare it with the row mappers.

## Consequences

Positive:

- A bug in the app or a forged request still cannot write: the policy rejects it.
- The publishable key can be public by design.
- Hidden items stay hidden from the API, not only from the UI.

Negative / trade-offs:

- Admin identity is the JWT email, matched case-insensitively. Changing the admin email needs both `ADMIN_EMAIL` and an allowlist row.
- Authorization is defined in three places (proxy, actions, SQL). Tests keep them aligned, but a change must touch all three.
- `is_admin()` runs as `security definer`. It is kept to one `exists` query, and `execute` is revoked from `public` and granted only to `anon` and `authenticated`.
- Uploads go straight to Storage, so the policy checks who uploads, not what. Size and MIME rules in `src/lib/admin/upload.ts` run in the browser, and the migration sets no bucket limits.

## Evidence

- Policies: [20261018185208_init.sql](../../supabase/migrations/20261018185208_init.sql), [20261018185337_private_admin.sql](../../supabase/migrations/20261018185337_private_admin.sql), [supabase/config.toml](../../supabase/config.toml)
- App guards: [src/proxy.ts](../../src/proxy.ts), [src/lib/admin/guard.ts](../../src/lib/admin/guard.ts), [src/lib/admin/session.ts](../../src/lib/admin/session.ts), [src/lib/admin/auth.ts](../../src/lib/admin/auth.ts)
- Tests: [tests/unit/admin-guard.test.ts](../../tests/unit/admin-guard.test.ts), [tests/unit/proxy.test.ts](../../tests/unit/proxy.test.ts), [tests/unit/admin-session.test.ts](../../tests/unit/admin-session.test.ts), [tests/unit/db-schema.test.ts](../../tests/unit/db-schema.test.ts)
- Real denial probes against a disposable database: [ADR-0010](0010-disposable-supabase-integration-tests.md)
