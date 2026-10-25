# Read-only Reviewer Access (Task 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dedicated reviewer identity can open every admin screen (preview and production) and read all portfolio content, hidden rows, media metadata and version history, while every write is refused by the server and by the database.

**Architecture:**
- **Identity:** a private UID allowlist (`private.app_reviewers`) with `private.is_reviewer()`, mirroring `private.app_admins` / `private.is_admin()`.
- **Database:** additive SELECT-only RLS policies for the reviewer.
- **App:** a single `getAdminAccess()` resolves `admin | reviewer | null`. Reads use `requireContentRead()`; every mutation keeps `requireAdmin()`.
- **Client:** a client context makes the whole admin UI read-only.

**Tech Stack:** Next.js 16 (Cache Components), Supabase Auth/RLS/Storage/Realtime, React 19, vitest, local Supabase CLI integration (Task 4).

**Spec:** `docs/superpowers/specs/2026-10-21-final-review-release-design.md` ("Read-only preview access"), as amended by `docs/superpowers/specs/2026-10-25-continuation-design.md` §3 and §7. The amendment wins where they differ: production allowed, history readable, UID table.

## Global Constraints

- **Migration:**
  - Additive only: new table, functions and policies; `create or replace` only for `admin_list_versions`, with the old body kept in rollback SQL.
  - Generate the file with the pinned CLI (`npx supabase migration new reviewer_read_only`); never invent a timestamp.
  - Mirror the SQL in `src/lib/data/schema-sql.ts` and run `npm run db:schema`.
- **Hosted changes:**
  - No hosted migration, account creation, UID insert or merge without the owner's explicit security approval of the concrete diff.
  - After approval, apply through Supabase MCP with the same version and name as the repo file.
- **Lint 0029:** no `security definer` function in `public` that `authenticated` can execute.
- **Mutation authorization is unchanged:** hiding buttons is a convenience; `requireAdmin()` plus RLS are the guards.
- **Reviewer reads must not write:**
  - no draft-mode cookie;
  - no localStorage drafts;
  - no realtime broadcast;
  - no "touch" updates.
- **Public docs:**
  - the public repo never contains the reviewer email or UID;
  - the private Vietnamese approval page lives in `.superpowers/` (gitignored).
- **Process:** run `npm run verify` before every push; no attribution lines.

## Review Focus

1. A reviewer calling any exported mutation server action directly (not through the UI) gets FORBIDDEN and causes no DB call. *(Task 3 test)*
2. A reviewer token used directly against PostgREST/Storage cannot insert, update, delete, upload, remove, restore a version, or read `private.app_admins`. *(Task 5 integration checks)*
3. Removing the reviewer's row revokes access at the next request, without waiting for token expiry. *(Task 2 unit test, Task 5 integration check)*
4. An ordinary signed-in non-admin, non-reviewer user is still redirected and refused exactly as today. *(Task 2 test)*
5. Admin behaviour is unchanged: every existing test stays green, with no new prompts or disabled controls for the admin. *(full suite)*

---

### Task 1: Reviewer database access

**Files:**
- Create: `supabase/migrations/<CLI timestamp>_reviewer_read_only.sql`
- Modify: `src/lib/data/schema-sql.ts` (`REVIEWER_SQL`, appended to `renderSchemaSql()`), `supabase/schema.sql`
- Test: `tests/unit/db-schema.test.ts`

**SQL (exact semantics):**
- **Allowlist table:** `private.app_reviewers(user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now())`. RLS enabled, no policies, `revoke all … from public, anon, authenticated`.
- **`private.is_reviewer()`:** `security definer`, `stable`, `set search_path = ''`; true when a row exists for `auth.uid()`. Revoke from public; grant execute to `authenticated`.
- **`public.admin_access_kind()`:** returns `text`; `security invoker`, `stable`, `set search_path = ''`.
  - Returns `'admin'` when `private.is_admin()`, `'reviewer'` when `private.is_reviewer()`, otherwise `null`.
  - Revoke from public and anon; grant to `authenticated`.
- **Content tables:** for each of the 10 tables, `create policy "<t>_reviewer_read" on public.<t> for select to authenticated using (private.is_reviewer());`.
- **Storage:** `create policy "reviewer_media_select" on storage.objects for select to authenticated using (bucket_id in ('media','files') and private.is_reviewer());`.
- **Version history:** `create policy "content_versions_reviewer_read" on private.content_versions for select to authenticated using (private.is_reviewer());`.
- **`admin_list_versions`:** `create or replace` keeping the same signature and security invoker, but refusing unless `private.is_admin() or private.is_reviewer()`. `admin_restore_version` is unchanged (admin only).
- **Realtime:** `create policy "reviewer_content_receive" on realtime.messages for select to authenticated using (realtime.topic() = 'admin:content' and private.is_reviewer());`.

**Steps:**
- [ ] **Step 1: failing tests** in `db-schema.test.ts`, `describe("reviewer access")`:
  - the 10 reviewer read policies exist;
  - no reviewer policy is `for insert|update|delete|all`, and the SQL contains no `insert`/`update`/`delete` grants to the reviewer;
  - `admin_access_kind` is `security invoker`;
  - `is_reviewer` is revoked from anon;
  - `admin_restore_version` still checks only `private.is_admin()`;
  - the migration file contains `REVIEWER_SQL`.
- [ ] **Step 2:** run them. Expected: FAIL.
- [ ] **Step 3:** run `npx supabase migration new reviewer_read_only`, write the SQL into it, add `REVIEWER_SQL` and run `npm run db:schema`.
- [ ] **Step 4:** run the tests. Expected: PASS.
- [ ] **Step 5:** commit `feat(db): read-only reviewer allowlist and policies`.

### Task 2: One access resolver for proxy, layouts and actions

**Files:**
- Create: `src/lib/admin/access.ts`
- Modify: `src/lib/admin/guard.ts`, `src/lib/admin/session.ts`
- Test: `tests/unit/admin-access.test.ts`, `tests/unit/admin-guard.test.ts`

**Interfaces:**
- `type AdminAccess = { kind: "admin" | "reviewer"; email: string }`.
- `resolveAccess(user, rpcKind, env): AdminAccess | null` is pure:
  - `admin` only when `isAdminEmail(user.email, env.ADMIN_EMAIL)`, as today;
  - otherwise `reviewer` only when `rpcKind === "reviewer"`;
  - anything else is `null`.
- `getAdminAccess(): Promise<AdminAccess | null>`:
  - calls `supabase.auth.getUser()`;
  - for non-admin users calls `rpc("admin_access_kind")`;
  - an RPC error is `null` (fail closed).
- `requireContentRead(): Promise<AdminAccess>` throws `SESSION_EXPIRED` (no user) or `FORBIDDEN`.
- `requireAdmin()` is unchanged.
- `adminGuard` lets reviewers into `/admin/**` page requests, using the same RPC through the guard's client.

**Steps:**
- [ ] **Step 1: failing tests:**
  - matrix for admin email → admin; non-admin with rpc `"reviewer"` → reviewer; rpc `null`, `"admin"` (for a non-admin email) or an error → null; no user → null;
  - user metadata such as `app_metadata.role` or `user_metadata.reviewer` is ignored;
  - the guard redirects a member with rpc `null` and lets a reviewer through;
  - revocation: the same user with rpc `null` on the next call is refused.
- [ ] **Steps 2–4:** run (FAIL), implement, run (PASS).
- [ ] **Step 5:** commit `feat(admin): resolve admin or read-only reviewer access in one place`.

### Task 3: Server reads open to the reviewer, writes stay admin-only

**Files:**
- Modify: `src/app/admin/actions.ts` (`listVersions`, `checkAdminSession`), `src/app/admin/media-actions.ts` (`listMedia`), `src/app/admin/(panel)/layout.tsx`, admin pages that create items (`[resource]/[id]` with `new`/`from`)
- Test: `tests/unit/admin-actions.test.ts`, `tests/unit/admin-media-actions.test.ts` (or the existing media action test)

**Behaviour:**
- **Reads:**
  - `listVersions`, `listMedia` and `checkAdminSession` use `requireContentRead()`;
  - layouts and pages use `getAdminAccess()` and render nothing for `null`.
- **Writes:** every mutation export keeps `requireAdmin()`, so a reviewer gets `{ ok: false, code: "FORBIDDEN" }` with no Supabase call.
- **Create pages:** `/admin/<key>/new` and `?from=` show "Chế độ chỉ đọc: không tạo mục mới" for a reviewer.
- **Draft mode:** `/admin/preview` stays admin-only, and a reviewer gets the existing forbidden response.

**Steps:**
- [ ] **Step 1: failing tests:**
  - `it.each` over every mutation export with `requireAdmin` rejecting `FORBIDDEN` while `requireContentRead` resolves a reviewer: result `code: "FORBIDDEN"`, zero DB calls;
  - `listVersions` and `listMedia` succeed for a reviewer.
- [ ] **Steps 2–4:** run (FAIL), implement, run (PASS).
- [ ] **Step 5:** commit `feat(admin): let the reviewer read while every write stays admin-only`.

### Task 4: Read-only admin UI

**Files:**
- Create: `src/components/admin/AdminAccessProvider.tsx` (client context: `useAdminAccess(): { kind; readOnly }`), `src/components/admin/ReadOnlyNotice.tsx`
- Modify: the `(panel)` layout (provider and notice), `ResourceTable`, `ResourceForm` (`FieldsForm`), `SkillMatrix`, `SingletonForms` (`OpenToWorkSwitch`, forms), `VersionHistory`, `MediaBrowser`, `UploadField`, `QuickCreate`, the list page "Thêm mới" button, the `AdminCommand` create entries
- Test: `tests/unit/admin-read-only.test.tsx`

**Behaviour for `readOnly`:**
- **Notice:** a persistent `role="status"` notice reads "Chế độ chỉ đọc — bạn có thể xem mọi nội dung nhưng không thể thay đổi".
- **Forms:** the form body is wrapped in `<fieldset disabled>`, so fields stay readable. There is no SaveBar, no draft autosave or draft bar, and no unsaved-changes guard.
- **Lists:** no switch, duplicate, delete or drag handle, and no "Thêm mới".
- **Matrix:** cells are disabled (`aria-disabled`), with no "+ Thêm skill" and no save bar.
- **History:** the list and diff are visible, without "Khôi phục bản này".
- **Media:** no upload or delete; the picker is browse-only.
- **Shortcuts:** QuickCreate and the ⌘K create group are hidden.
- **Admin view:** unchanged.

**Steps:**
- [ ] **Step 1: failing tests:** for each component rendered inside the provider with `readOnly`, the mutation controls are absent or disabled and the content is visible. For the admin provider, the same controls are present.
- [ ] **Steps 2–4:** run (FAIL), implement, run (PASS), then run `npm run verify`.
- [ ] **Step 5:** commit `feat(admin): read-only admin interface for the reviewer`.

### Task 5: Real-service checks (Task 4 environment)

**Files:**
- Modify: `scripts/ci/run-admin-integration.mjs` (seed a synthetic reviewer user and insert its UID into `private.app_reviewers`), `scripts/ci/verify-admin-backend.mjs`
- Test: the existing script unit tests for the seed and reporter

**Backend checks, with a reviewer-signed client:**
- Reads:
  - `select` on a hidden certificate returns it;
  - `admin_list_versions` returns rows;
  - Storage `list` in `media` succeeds;
  - realtime join of `admin:content` succeeds.
- Writes, each denied:
  - insert, update and delete on `certificates`;
  - Storage upload and remove;
  - `admin_restore_version`.
- `private` reads are denied.
- Revocation:
  - after deleting the reviewer row (service-role fixture step), `admin_access_kind()` returns null;
  - the hidden row is no longer visible.
- The checks run in CI only (Docker); locally they stay BLOCKED. The workflow file is not changed.

**Steps:**
- [ ] **Step 1:** failing unit tests for the new seed step and check labels.
- [ ] **Steps 2–4:** implement, then run the script unit tests (PASS).
- [ ] **Step 5:** commit `test(admin): real reviewer read and write-denial checks`.

### Task 6: Security review package and docs

**Files:**
- Create: `docs/security/reviewer-access.md` (public, sanitized)
- Create (local, ignored): `.superpowers/task5-approval.md` (Vietnamese)

**Content:**
- **Public doc:**
  - threat model and access matrix (admin / reviewer / member / anon × read / write per surface);
  - where each guard lives;
  - residual risks: shared database, hidden content and history readable, email of the editor in history;
  - rollout, verification and rollback SQL with placeholders `<reviewer-uid>`.
- **Private page:**
  - the same information in Vietnamese;
  - the real account identifier;
  - the exact UID insert, rollout and rollback SQL;
  - test and CI evidence;
  - the auditor report.

**Steps:**
- [ ] Write both documents.
- [ ] Dispatch `ai-generated-code-auditor` on the whole branch, then do ONE fix pass, test-first.
- [ ] Push and open the PR, marked sensitive. Do not merge and do not apply the migration.
- [ ] Ask the owner for approval with the private page.
- [ ] **After approval:**
  1. apply the migration through MCP (same version);
  2. run a read-only check of policies and functions, plus the advisor;
  3. the owner creates the account, signs in once and inserts the UID;
  4. the AI verifies reviewer reads on preview and production, with no write probes on hosted data;
  5. merge bound to the reviewed SHA.
