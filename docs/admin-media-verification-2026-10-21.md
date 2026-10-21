# Batch 5 — remote Storage verification

## Target and applied change

- Date: 2026-10-21.
- Confirmed project: `letcal-portfolio` (`uptfqrntfrelilwjfznk`), matching the application's configured Supabase hostname.
- Applied through the authenticated Supabase integration: migration **`admin_media_select`**, recorded remotely as **`20261021141852`**.
- SQL matches [the reviewed local migration](../supabase/migrations/20261021124334_admin_media_select.sql). Supabase generated the remote history timestamp at application time; the local CLI-generated timestamp is different. Do not blindly replay the local migration with `db push` against this existing database or apply the policy twice. Reconcile migration history first if moving deployment to the CLI.
- Added only `admin_media_select`: SELECT to `authenticated`, scoped to `media`/`files` and `private.is_admin()`.

## Before/after catalog comparison

| Check | Result |
| --- | --- |
| Previous `admin_upload`, `admin_update`, `admin_delete` policies | Unchanged |
| Added Storage policy | Exactly one: `admin_media_select`, SELECT, role `authenticated` |
| Storage objects RLS | Enabled before and after |
| Existing `private.is_admin()` definition and caller privileges | Unchanged; authenticated has schema usage and function execute |
| Direct access to private admin whitelist | Neither anon nor authenticated has SELECT permission |
| Buckets | Same two public buckets: `media`, `files` |
| Object counts | Zero before and after |
| Accounts, files and saved portfolio content | Not modified during verification |

## Database role checks

Executed against the real database inside **read-only transactions**, with transaction-local JWT claims and `SET LOCAL ROLE`, followed by rollback. These are policy/helper checks, not signed Supabase Auth sessions.

| Context | `private.is_admin()` | Policy predicate: media/files | Outside-library predicate | Visible objects |
| --- | --- | --- | --- | --- |
| Authenticated, existing admin email claim | true | true | false | 0 |
| Authenticated, synthetic non-admin email claim | false | false | false | 0 |
| Anonymous, empty claims | false | No SELECT policy targets anon | Not granted | 0 |

The admin email was read inside the transaction, not printed or written into these documents. No test account was created. The predicates are evaluated against the reviewed policy conditions; because the buckets are empty, zero rows alone cannot prove isolation of existing objects.

Also called the real Storage list API with the application's public key and **no user session**: `media` and `files` both returned zero objects without an API error. This does not replace positive admin/non-admin object tests.

## Security advisor comparison

No added findings. Before and after both contain:

| Existing finding | Level | Disposition |
| --- | --- | --- |
| `rls_enabled_no_policy` on `private.app_admins` | INFO | Existing private whitelist intentionally has no caller-facing policy; do not add a broad read policy to silence the notice. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). |
| `auth_leaked_password_protection` | WARN | Existing Auth setting. [Supabase documents leaked-password protection as Pro and above](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); left unchanged under the approved zero-cost requirement. |

## Remaining owner/preview checks

An anonymous browser visit to the current PR preview correctly reached `/admin/login?next=%2Fadmin%2Fmedia`. The browser does not currently have an authenticated admin session. The login page was left open for the owner; credentials are not requested in chat.

After owner sign-in, use the [disposable-file preview checklist](admin-media-library.md#owner-preview-checklist) to verify positive listing, picker behavior, saved hidden references and the delete lifecycle. These authenticated file interactions have **not** been claimed as completed by the catalog, role or anonymous API checks above. The PR stays draft pending those checks and owner review.

Rollback SQL is prepared in [admin-media-storage-rollback.sql](admin-media-storage-rollback.sql), but was not executed: the additive policy remains installed for preview testing.
