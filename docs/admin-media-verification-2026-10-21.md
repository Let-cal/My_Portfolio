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

## Initial browser handoff

An anonymous browser visit to the PR preview correctly reached `/admin/login?next=%2Fadmin%2Fmedia`. At that point the browser had no authenticated admin session, so the login page was left open for the owner. Credentials were not requested in chat.

The owner subsequently signed in through the **in-app browser**. The authenticated checks below supersede the initial empty-bucket limitation for the tested PDF fixture. Owner review remains separate from these implementation checks.

## Authenticated preview follow-up

Target: `https://letcal-git-feat-admin-media-library-let-cals-projects.vercel.app/admin/media`, using the owner's existing signed-in session. No password/session token was read or copied.

Only disposable fixtures were created:

- Hidden certificate `test-item-media-qa-20261021`, explicitly labelled not a professional qualification, with `published=false` before its first save.
- One 1-page PDF labelled **DISPOSABLE MEDIA QA FIXTURE**, no personal information, **1,462 bytes**. Storage key: `files/pdf/9158c349-test-item-media-qa-20261021.pdf`.

| Browser check | Observed result |
| --- | --- |
| Initial signed-in library | Empty inventory, matching the database |
| Upload through certificate form | PDF uploaded successfully with the admin session |
| Picker | PDF shown with correct size/date/icon and the 10 MiB picker limit |
| Escape/cancel picker | No selection persisted; focus returned to **Chọn từ thư viện** |
| Select existing PDF | Returned its URL without a second upload; database still had **0 saved test certificates and 1 file** until explicit Save |
| Save hidden certificate | 1 hidden test item; original published count stayed 10 |
| Library usage | Linked the PDF to the hidden certificate and offered **no delete button** for the used file |
| Search/type/unused filters | Non-matching search and image filter hid the PDF; PDF filter restored it; unused-only excluded it while referenced |
| Reload | Retained correct usage and active filters |
| Light/mobile layout | At 390×844, CSS document width 375 and main width 343: no horizontal overflow; viewport override later reset |
| Remove file reference and Save | File became unused and its delete button appeared |
| Cancel delete | No deletion; keyboard focus returned to the original delete button |
| Confirm delete | Owner explicitly approved permanent removal of this exact fixture at action time; UI returned to 0 files and focus to search |
| Cleanup | Removed only the test certificate through the normal recoverable admin delete flow; restored the original dark theme |

### Positive RLS check with the uploaded object

While the PDF existed, repeated read-only role/claim transactions against that exact object returned:

| Context | Visible fixture objects |
| --- | --- |
| Authenticated admin claim | **1** |
| Authenticated synthetic non-admin claim | **0** |
| Anonymous empty claims | **0** |

These database probes still use local role/claim contexts; they do not claim a signed non-admin Auth session. The signed **admin** upload/list/delete path was exercised through the real browser. Real anonymous Storage list API calls also returned no objects while the fixture existed.

### Cleanup evidence and remaining limits

- Final database checks: **0 Storage objects**, **0 current test certificates**, **10 total / 10 published certificates** (matching the pre-test list). Normal content version history was left under the application's retention rules.
- Direct GET of the removed PDF returned HTTP **400** with Storage payload `404`, `Object not found`, `NoSuchKey`; the blob was not left behind.
- Local screenshots of used-file protection, mobile light layout, delete confirmation and the clean library are kept in ignored QA output, not published with account details in this public repository.
- Live concurrent-save/delete rejection, forced network loss, expiration during a media action, oversized/unknown-size picker cases and real image/video previews were not exercised in this signed-in session. Their automated coverage and the remaining owner checklist are distinguished from the live PDF lifecycle above. No other user/account was created, no forced sign-out was performed, and no atomic cross-tab deletion guarantee is claimed.
- Implementation is ready for owner PR review; owner approval and merge are not inferred from these checks.

Rollback SQL is prepared in [admin-media-storage-rollback.sql](admin-media-storage-rollback.sql), but was not executed: the additive policy remains installed for preview testing.
