# Admin UX Batch 3 (D: safe editing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every edit and delete in the admin can be seen and undone. Deletes get a 10-second "Hoàn tác" toast and an impact preview. Each item, the Profile and the Roles get a "Lịch sử" panel with a field diff and "Khôi phục bản này".

**Architecture:**
- Postgres triggers write the old row into `private.content_versions` on update and delete.
- Two `security definer` functions in `public` read and restore versions, and only admins may call them.
- Server actions wrap the functions.
- Pure TypeScript computes diffs and delete impact.
- A client `VersionHistory` sheet shows versions on the editor, Profile and Roles pages.

**Tech Stack:** Next.js 16 (Cache Components), Supabase Postgres (plpgsql, RPC), React 19, shadcn Sheet/Dialog, sonner, vitest.

**Spec:** `docs/superpowers/specs/2026-10-19-admin-ux-design.md`, §4 Đợt 3 (D1–D4) and §7.

## Global Constraints

- **Migrations:**
  - Add a new file `supabase/migrations/0004_content_versions.sql`. Old migrations are never edited.
  - The migration is **additive** only: new table, functions and triggers. No content column changes.
  - Rollback SQL goes in the PR description.
  - It is applied when the PR opens, because preview and production share one database.
- The non-content table is written into the migration **and** into the fixed part of `src/lib/data/schema-sql.ts`, so `supabase/schema.sql` (from `npm run db:schema`) stays true.
- **Server actions:** every write goes through a server action with `requireAdmin()` and then `updateTag("content")`. RLS stays the last guard.
- **Security:**
  - The `private` schema is not exposed by the Data API.
  - `admin_list_versions` and `admin_restore_version` check `private.is_admin()` first and raise if it is false.
  - `grant execute` goes to `authenticated` only, with `revoke` from `public` and `anon`.
- **Limits:**
  - Keep at most **50 versions per item**.
  - Skip updates that change only `sort_index`/`updated_at`.
  - Undo after delete groups rows by transaction with `txid_current()`, not by `changed_at`.
- Saving a skill syncs `skill_links` **by diff**, not delete-all and re-insert.
- **Process and cost:**
  - Zero cost, Supabase Free tier.
  - No new dependency.
  - Commits carry no attribution lines.
  - Run `npm run verify` before every push.
- **Testing on preview** uses a test item only: a hidden certificate `test-item`. Create it, edit, delete, undo, restore, then delete it for good.
- All UI copy is in Vietnamese, and matches the existing admin tone.

## Review Focus

1. **Undo of a delete that cascaded links.** Deleting a project removes its `skill_links` through `on delete cascade`. Undo must bring back the project **and** those links, and must skip a link whose skill was deleted later instead of failing the whole restore. *(Task 1 SQL check; Task 3 test.)*
2. **Restoring an older version while the item has other versions.** The restore is itself an update, so it creates a new version: the user can undo a restore. Restoring must never delete-and-insert, which would cascade away links. *(Task 1 SQL check.)*
3. **History of an item that has never changed** shows "Chưa có phiên bản nào", not an error. Restoring a version of a row that no longer exists, from the editor of a deleted item opened in another tab, re-creates it. *(Task 5 test; Task 1 SQL check.)*
4. **A non-admin signed-in user or the anon key calling the RPCs** gets an error and reads nothing. *(Task 1 SQL check with the publishable key.)*
5. **Diff of nested i18n and array fields** (`summary.ja`, `summaries.pm.en`, `tech`, `case_study.result.en`) shows one line per changed leaf, and skips `created_at`/`updated_at`/`sort_index`. *(Task 3 test.)*

---

### Task 1: Version table, triggers and RPCs

**Files:**
- Modify: `src/lib/data/schema-sql.ts` (export `VERSIONS_SQL`; `renderSchemaSql()` appends it after `storageSql()`)
- Create: `supabase/migrations/0004_content_versions.sql` (header comment + exactly `VERSIONS_SQL`)
- Regenerate: `supabase/schema.sql` (`npm run db:schema`)
- Test: extend `tests/unit/db-schema.test.ts`

**Interfaces:**
- **Produces (SQL):**
  - `private.content_versions(id bigint generated always as identity primary key, table_name text not null, item_key text not null, op text not null check (op in ('update','delete')), old_row jsonb not null, changed_by text, changed_at timestamptz not null default now(), txid bigint not null default txid_current())`.
  - Index on `(table_name, item_key, id desc)` and on `(txid)`.
- **Produces (RPC):**
  - `public.admin_list_versions(p_table text, p_key text) returns table (id bigint, op text, old_row jsonb, changed_by text, changed_at timestamptz)`, newest first, at most 50.
  - `public.admin_restore_version(p_version_id bigint) returns void`.
- **Produces (TS):** `VERSIONS_SQL: string` and `VERSIONED_TABLES` (the 10 table names: `profile, roles, experiences, projects, skills, skill_links, certificates, activities, education, why_cards`).

**Behaviour the SQL must have:**
- **Trigger `private.record_version()`** is `security definer`, `set search_path = ''`, and runs `after update or delete ... for each row` on every table in `VERSIONED_TABLES`.
  - On update, skip if `(to_jsonb(new) - 'sort_index' - 'updated_at') = (to_jsonb(old) - 'sort_index' - 'updated_at')`.
  - On `skill_links`, record only deletes.
  - `item_key = coalesce(old_row->>'id', old_row->>'key', old_row->>'skill_id')`.
  - `changed_by = auth.jwt() ->> 'email'`.
  - After the insert, delete versions of the same `(table_name, item_key)` beyond the newest 50.
- **`admin_restore_version`** checks `private.is_admin()` and raises `'not allowed'` otherwise. It validates `table_name` against the 10-name list, then:
  - **For an `update` version:** write `old_row` back with `insert … select * from jsonb_populate_record(null::public.<t>, old_row) on conflict (<pk>) do update set <every column> = excluded.<column>`. The primary key is `key` for `roles` and `id` for everything else. The column list comes from `information_schema.columns`. This re-creates the row if it was deleted, and never deletes it.
  - **For a `delete` version:** insert the row with `on conflict do nothing`. Then re-insert every `skill_links` delete version with the same `txid`, skipping links whose `skill_id`, `experience_id` or `project_id` no longer exists (`on conflict do nothing`).
- **Grants:** `revoke all on private.content_versions from public, anon, authenticated`. Both functions: `revoke execute … from public, anon` and `grant execute … to authenticated`.

- [ ] **Step 1: Failing tests** in `tests/unit/db-schema.test.ts`, in a new `describe("content versions")`:
  - `it("records versions on all 10 content tables")`: for each name in `VERSIONED_TABLES`, `renderSchemaSql()` contains `create trigger ${name}_version after update or delete on public.${name}`.
  - `it("ignores reorder-only updates and keeps 50 versions per item")`: `VERSIONS_SQL` contains `- 'sort_index' - 'updated_at'` and `offset 50`.
  - `it("only signed-in admins can list or restore")`: `VERSIONS_SQL` contains `grant execute on function public.admin_list_versions(text, text) to authenticated`, contains the same grant for `public.admin_restore_version(bigint)`, contains `revoke execute on function public.admin_restore_version(bigint) from public, anon`, and contains `private.is_admin()` at least twice.
  - `it("the migration is exactly the versions section")`: `readFileSync("supabase/migrations/0004_content_versions.sql")` with CRLF normalised contains `VERSIONS_SQL`.
- [ ] **Step 2:** `npx vitest run tests/unit/db-schema.test.ts`. Expected: the new tests FAIL with `VERSIONS_SQL` undefined.
- [ ] **Step 3:** Implement `VERSIONS_SQL` and the migration, then run `npm run db:schema`.
- [ ] **Step 4:** Run the same command. Expected: PASS, including "the committed schema is generated from columns.ts".
- [ ] **Step 5: Apply and verify on the database.** Use Supabase MCP `apply_migration` (name `content_versions`). Then run `execute_sql` checks, each inside a `do $$ … raise exception 'RESULT …' $$` block so nothing persists:
  - (a) Inside a block that runs as the admin (`set local request.jwt.claims = '{"email":"letcal2003@gmail.com","role":"authenticated"}'`, `set local role authenticated`), insert a hidden certificate `test-item`. Update its name, delete it, and call `admin_restore_version` on the delete version: the row is back.
  - (b) Update `sort_index` only: no new version.
  - (c) Delete a project that has links, then restore: the project is back and its link count matches.
  - (d) As `role anon`: calling `public.admin_list_versions` raises.

  Then run `get_advisors` (security): no new WARN. Ledger each result.
- [ ] **Step 6: Commit** `feat(db): content versions with admin-only list and restore`.

### Task 2: Skill save syncs links by diff

**Files:** Modify `src/app/admin/actions.ts` (the `k === "skills"` branch of `saveResource`); test in `tests/unit/admin-actions.test.ts`.

**Interfaces:** Consumes `diffLinks(current: string[], wanted: string[]) → { add; remove }`, `linkRow`, `linkMatch` from `src/lib/admin/links.ts`. For a skill, the link targets are `exp:<id>` and `proj:<id>` keys built from `experienceIds`/`projectIds`.

- [ ] **Step 1: Failing test** `it("saving a skill only adds and removes the links that changed")`:
  - Given existing links `react ↔ siteplus` and `react ↔ skg-coa`, saving `react` with `projectIds: ["siteplus", "zodiacgems"]` and `experienceIds: []` must:
    - insert exactly `[{ skill_id: "react", experience_id: null, project_id: "zodiacgems" }]`;
    - delete with match `{ skill_id: "react", experience_id: "skg-coa" }`;
    - never call `delete().eq("skill_id", "react")`.
- [ ] **Step 2:** Run it. Expected: FAIL, because the current code deletes all links.
- [ ] **Step 3:** Implement with the same select/diff/insert/delete pattern as the experiences/projects branch.
- [ ] **Step 4:** Run `npx vitest run tests/unit/admin-actions.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(admin): saving a skill changes only the links that moved`.

### Task 3: Version actions and field diff

**Files:**
- Create: `src/lib/admin/versions.ts` (pure)
- Modify: `src/app/admin/actions.ts`
- Test: `tests/unit/admin-versions.test.ts`; extend `tests/unit/admin-actions.test.ts` (the fake client gets `rpc(name, args)`, which records calls and answers from a `rpcResults` map)

**Interfaces:**
- **Produces (pure, in `versions.ts`):**
  - `type Version = { id: number; op: "update" | "delete"; oldRow: Record<string, unknown>; changedBy: string | null; changedAt: string }`.
  - `type DiffLine = { field: string; before: string; after: string }`.
  - `diffRow(before: Record<string, unknown>, after: Record<string, unknown> | null): DiffLine[]`. It flattens objects to dotted leaves (`summary.ja`, `summaries.pm.en`) and shows arrays joined with `", "`, `null`/`""` as `"—"`, and booleans as `"Có"`/`"Không"`. It skips `created_at`, `updated_at` and `sort_index`, and only returns lines that differ. When `after` is null (the row is deleted), every `before` leaf is returned with `after: "—"`.
  - `tableFor(key: ResourceKey | "profile" | "roles"): string` (the resources table, `"profile"` or `"roles"`).
- **Produces (server actions in `actions.ts`):**
  - `listVersions(table: string, itemKey: string): Promise<{ ok: true; versions: Version[]; current: Record<string, unknown> | null } | { ok: false; error: string }>`. It calls the `admin_list_versions` RPC and selects the current raw row by its primary key (`key` for roles).
  - `restoreVersion(versionId: number): Promise<ActionResult>`. It calls the `admin_restore_version` RPC, then `updateTag("content")`.
  - `undoDelete(table: string, itemKey: string): Promise<ActionResult>`. It lists the versions, restores the newest one with `op === "delete"`, and returns `{ ok: false, error: "Không còn bản đã xóa để hoàn tác." }` when there is none.
  - All three call `requireAdmin()` first and validate `table` against `VERSIONED_TABLES`.

- [ ] **Step 1: Failing tests:**
  - **`admin-versions.test.ts`:**
    - `it("lists one line per changed leaf, i18n by language")`: `diffRow({ summary: { en: "A", ja: "", vi: "C" }, tech: ["a"], sort_index: 1 }, { summary: { en: "A", ja: "B", vi: "C" }, tech: ["a", "b"], sort_index: 9 })` equals `[{ field: "summary.ja", before: "—", after: "B" }, { field: "tech", before: "a", after: "a, b" }]`.
    - `it("shows the whole old row when the item is gone")`: `diffRow({ id: "x", name: "N" }, null)` has `{ field: "name", before: "N", after: "—" }`.
  - **`admin-actions.test.ts`:**
    - `undoDelete("certificates", "test-item")` with `rpcResults.admin_list_versions = [{ id: 7, op: "update", … }, { id: 5, op: "delete", … }]` calls `rpc("admin_restore_version", { p_version_id: 5 })`, then calls `updateTag`.
    - `restoreVersion` refuses non-admins without any rpc call.
    - `listVersions("nope", "x")` returns `ok: false`.
- [ ] **Step 2:** Run both files. Expected: FAIL (module and exports missing).
- [ ] **Step 3:** Implement. The RPC rows map `old_row`→`oldRow`, `changed_by`→`changedBy` and `changed_at`→`changedAt`.
- [ ] **Step 4:** Run both files. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): list, diff and restore versions; undo a delete`.

### Task 4: Delete impact and undo toast

**Files:**
- Create: `src/lib/admin/impact.ts`
- Modify: `src/components/admin/ResourceTable.tsx` and `src/app/admin/(panel)/[resource]/page.tsx`
- Test: `tests/unit/admin-impact.test.ts`; extend `tests/unit/resource-table.test.tsx`

**Interfaces:**
- **Produces:** `deleteImpact(key: ResourceKey, id: string, c: AdminContent): string[]`. The Vietnamese lines are:
  - `Mất ${n} liên kết kỹ năng` when n > 0. For experiences/projects, n is the number of skills listing the id. For skills, n is the skill's evidence count.
  - `Why card "${title.en}" đang trỏ tới mục này` for each why card whose `evidenceLink` is `#exp-${id}` or `#proj-${id}`.
  - `Vai trò "${title.en}" có mục này trong thứ tự kinh nghiệm` for each role whose `experienceOrder` includes the id. This applies to experiences only.
- `ResourceTable` gets a new prop `impacts: Record<string, string[]>`, which the page builds from `getAdminContent()`.

- [ ] **Step 1: Failing tests:**
  - **`admin-impact.test.ts`**, on the seed:
    - deleting the experience used by the first why card lists that card;
    - an experience in a role's `experienceOrder` lists the role;
    - a skill with 0 evidence gives `[]`.
  - **`resource-table.test.tsx`:**
    - `it("lists what a delete affects before confirming")`: render with `impacts={{ [rows[0].id]: ["Mất 3 liên kết kỹ năng"] }}`, open the delete dialog, and the dialog contains that line.
    - `it("offers Hoàn tác for 10 seconds after a delete")`: with `deleteResource` resolving `{ ok: true }`, `toast.success` is called with `(expect.stringContaining("Đã xóa"), expect.objectContaining({ duration: 10000, action: expect.objectContaining({ label: "Hoàn tác" }) }))`. Calling `action.onClick()` calls `undoDelete(<table>, id)`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - The dialog shows the impact lines as a list under the description, with a warning icon and the title "Sẽ bị ảnh hưởng:". With no impact it shows nothing extra.
  - On successful undo: `toast.success("Đã khôi phục …")` and `router.refresh()`, and the row returns after the refresh.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): show what a delete affects and offer undo`.

### Task 5: History panel

**Files:**
- Create: `src/components/admin/VersionHistory.tsx` (client)
- Modify: `src/app/admin/(panel)/[resource]/[id]/page.tsx` (not for new items), `src/app/admin/(panel)/profile/page.tsx` and `src/components/admin/SingletonForms.tsx` (`RoleTabs`: one button per active role)
- Test: `tests/unit/version-history.test.tsx`

**Interfaces:**
- **Produces:** `VersionHistory({ table, itemKey }: { table: string; itemKey: string })`.
  - It renders a button "Lịch sử" that opens a right-side `Sheet` titled "Lịch sử thay đổi". On open it calls `listVersions`.
  - Each version shows the relative time (`Intl.RelativeTimeFormat("vi")`), the email, and an op badge ("Sửa"/"Xóa").
  - Selecting a version shows `diffRow(version.oldRow, current)` as a table with columns Trường / Bản này / Hiện tại, plus a button "Khôi phục bản này".
  - The button calls `confirmLeave()` first (unsaved edits on the page). On ok it shows `toast.success("Đã khôi phục phiên bản")` and calls `window.location.reload()` so the form remounts with the restored data.
  - Empty list: "Chưa có phiên bản nào. Mỗi lần lưu sẽ tạo một phiên bản để khôi phục."
  - Loading uses a skeleton. Errors show in `role="alert"`.
- **Consumes:** `listVersions` and `restoreVersion` from Task 3, `diffRow` from Task 3, and `confirmLeave` from `SaveBar.tsx`.

- [ ] **Step 1: Failing tests** (mock `@/app/admin/actions`):
  - `it("shows versions and the fields that changed")`: `listVersions` resolves two versions plus a current row. After opening, both versions are listed. Clicking the first shows a row for `name` with before and after values.
  - `it("restores the chosen version")`: clicking "Khôi phục bản này" calls `restoreVersion(<id>)`. Stub `window.location.reload` with `vi.fn` and expect it to be called.
  - `it("explains an empty history")`: the empty-state text shows.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement, then wire it in:
  - the editor header, next to the Trước/Sau links, for existing items only;
  - the Profile page header, with `table "profile"` and key `"me"`;
  - each role tab panel, with `table "roles"` and the role key.
- [ ] **Step 4:** Run `npm run verify`. Expected: everything passes.
- [ ] **Step 5: Commit** `feat(admin): history panel with field diff and restore`.

### Task 6: Finish

- [ ] Final whole-branch review on the most capable model. Then ONE fix pass for Critical/Important findings, test first.
- [ ] Push, open the PR with:
  - the rollback SQL (`drop trigger … ; drop function public.admin_restore_version(bigint), public.admin_list_versions(text, text), private.record_version(); drop table private.content_versions;`);
  - the preview checklist using `test-item`.
- [ ] Turn on Auto-fix and wait for the owner's "merge".
