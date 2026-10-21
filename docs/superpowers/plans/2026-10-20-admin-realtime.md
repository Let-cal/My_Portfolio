# Admin Realtime & Data Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every admin screen shows fresh data without a reload. This holds in the current tab right after each write, and in other tabs and devices within about 2 s. Nothing typed is lost to network drops, expired sessions or closed tabs.

**Architecture:**
- Write actions call `refresh()` and `updateTag("content")`.
- Client components re-sync from server props, while keeping optimistic state and dirty forms intact.
- A database trigger sends a tiny private Broadcast (`admin:content`) that only admins can receive. A provider in the admin layout listens and calls `router.refresh()`.
- Drafts live in `localStorage`.
- The proxy lets server actions through so `requireAdmin()` can answer `SESSION_EXPIRED`.

**Tech Stack:** Next.js 16 (`refresh`/`updateTag` from `next/cache`), React 19, Supabase Realtime (private broadcast, `realtime.send`, RLS on `realtime.messages`), sonner, `motion/react`, vitest.

**Spec:** `docs/superpowers/specs/2026-10-20-admin-realtime-design.md`

## Global Constraints

- **Writes:** every write goes through a server action with `requireAdmin()`, then `updateTag("content")` and `refresh()`. RLS stays the last guard.
- **Migrations:**
  - Additive only: new functions, triggers and policies.
  - Mirror them in `src/lib/data/schema-sql.ts`, and regenerate with `npm run db:schema`.
  - Rollback SQL goes in the PR.
  - Apply through MCP. If MCP declines, the owner runs it in the SQL Editor.
- **Cost and dependencies:** zero cost and no new dependency.
- **Process:**
  - Run `npm run verify` before every push.
  - No attribution lines.
  - All UI copy in Vietnamese.
- **Behaviour rules:**
  - A dirty form is never overwritten.
  - No toast for this tab's own changes.
  - No flicker and no lost scroll position.
- **Motion:** 150–250 ms, and off when the user reduces motion (`MotionConfig reducedMotion="user"` already wraps admin).
- **Preview testing** uses `test-item` only, because the database is shared with production.

## Review Focus

1. A dirty form receives new server data, from its own save or from another tab. It must keep the user's edits and show the bar. It must never silently reset. *(Task 1 test)*
2. An optimistic toggle or reorder is pending while a refresh arrives. The pending value must win until the action settles. *(Task 1 test)*
3. A server action is POSTed with no session after a sign-out in another tab. It must return `SESSION_EXPIRED`, not a redirect page, and the form must stay. *(Task 3 tests: guard and action)*
4. The tab's own write echoes back through Realtime. That must cause no "Đã cập nhật từ nơi khác" toast, and only one refresh after the debounce. *(Task 6 test)*
5. A draft is restored for an item that changed since the draft was saved. The bar must say the draft is older, and restoring must not wipe fields that the draft does not contain. *(Task 5 test)*

---

### Task 1: Fresh data in the current tab

**Files:**
- Modify: `src/app/admin/actions.ts` (all write actions)
- Modify: `src/components/admin/ResourceTable.tsx`, `src/components/admin/SkillMatrix.tsx`, `src/components/admin/SingletonForms.tsx` (`OpenToWorkSwitch`), `src/components/admin/ResourceForm.tsx` (`FieldsForm`), `src/components/admin/VersionHistory.tsx`
- Create: `src/lib/admin/sync.ts` (pure)
- Test: `tests/unit/admin-actions.test.ts`, `tests/unit/admin-sync.test.ts`, `tests/unit/resource-table.test.tsx`, `tests/unit/form-incoming.test.tsx`

**Interfaces:**
- **Produces (in `sync.ts`):**
  - `signature(value: unknown): string`: a stable JSON with sorted keys, used to tell whether server data changed.
  - `mergeRows<T extends { id: string }>(server: T[], pending: Map<string, Partial<T> | "deleted">): T[]`: server rows with pending optimistic overrides applied.
- **Produces (in `ResourceForm.tsx`):** `FieldsForm` gets an incoming-data rule. When the `initial` signature changes:
  - if the form is not dirty, `form.reset(initial)`;
  - if it is dirty, show `<NewerVersionBar onReload onKeep>` with the text "Có bản mới hơn — Tải lại / Giữ bản của tôi".
- **Produces (window event):** `ADMIN_DISCARD_EVENT = "admin:discard-edits"`. VersionHistory dispatches it before a restore so the form drops its edits without showing the bar.

- [ ] **Step 1: Failing tests**
  - **`admin-actions.test.ts`:** `vi.mock("next/cache", () => ({ updateTag, refresh }))`. Add `it.each` over every write action (`saveResource`, `deleteResource`, `reorderResource`, `togglePublished`, `duplicateResource`, `saveSkillLinks`, `saveProfile`, `setOpenToWork`, `saveRole`, `restoreVersion`, `undoDelete`) with valid input. Expect `updateTag("content")` and `refresh()` to be called once each.
  - **`admin-sync.test.ts`:**
    - `signature({b:1,a:[1,{d:2,c:3}]}) === signature({a:[1,{c:3,d:2}],b:1})`;
    - `mergeRows` applies the pending `hidden` value and drops rows marked "deleted".
  - **`resource-table.test.tsx`:** `it("shows rows that arrive from the server")`. Rerender with an extra row in `initialRows`, and it appears. While a toggle is pending (action promise unresolved), a rerender with the old value keeps the toggled value.
  - **`form-incoming.test.tsx`:**
    - `it("takes new server data when nothing is edited")`: rerender `ResourceForm` with a changed `initial.name`, and the input shows the new name.
    - `it("asks before replacing unsaved edits")`: type into the name, rerender with new `initial`, and the bar "Có bản mới hơn" appears. "Giữ bản của tôi" keeps the typed text; "Tải lại" shows the server value.
- [ ] **Step 2:** Run `npx vitest run tests/unit/admin-actions.test.ts tests/unit/admin-sync.test.ts tests/unit/resource-table.test.tsx tests/unit/form-incoming.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement**
  - `refresh()` goes inside `adminWrite`, `adminSave` and `saveSkillLinks` after `updateTag`.
  - `ResourceTable` and `SkillMatrix` derive from props through `mergeRows`/`signature`, and keep only pending overrides in state.
  - `OpenToWorkSwitch` follows its prop unless a change is pending.
  - `VersionHistory`: replace `window.location.reload()` with dispatching `ADMIN_DISCARD_EVENT`, `toast.success("Đã khôi phục phiên bản")`, `setOpen(false)` and `router.refresh()`.
- [ ] **Step 4:** Run the same tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): every screen follows server data after a write`.

### Task 2: After-save flow

**Files:**
- Create: `src/lib/admin/public-link.ts`
- Modify: `ResourceForm.tsx` (save success) and `ResourceTable.tsx` (highlight)
- Test: `tests/unit/admin-public-link.test.ts`, `tests/unit/resource-table.test.tsx`, `tests/unit/form-incoming.test.tsx`

**Interfaces:**
- **Produces:** `publicAnchor(key: ResourceKey, id: string): string`. Values:
  - experiences → `exp-<id>`
  - projects → `proj-<id>`
  - education → `edu-<id>`
  - certificates → `certificates`
  - skills → `skills`
  - why_cards → `why`
  - activities: the section that renders them. Check in `src/components/sections`, otherwise fall back to `experience`.
- **Produces:** `publicUrl(key, id, origin: string): string` returns `${origin}/en#${publicAnchor(key, id)}`.
- **List URL:** `/admin/<key>?highlight=<id>` makes the list scroll that row into view (`block: "center"`) and pulse a primary-tinted background for 1.5 s with `motion`. The param is then removed with `router.replace` and `{ scroll: false }`.

- [ ] **Step 1: Failing tests**
  - Unit test the `publicAnchor` values above.
  - Rendering `ResourceTable` with `highlightId` marks that row `data-highlight="true"`.
  - After a successful create, `FieldsForm` pushes `/admin/certificates?highlight=<id>`. Its `toast.success` options carry actions "Mở lại" (`/admin/certificates/<id>`) and "Tạo thêm" (`/admin/certificates/new`), plus "Xem trên trang" only when the item is published or has no published flag.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement**
  - The page reads `searchParams.highlight` and passes it as `highlightId`.
  - The toast has three actions. Sonner supports one `action` and one `cancel`, so render a small custom toast body with three buttons through `toast.custom` or a `description` JSX.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): land on the saved item with quick next steps`.

### Task 3: Expired session without losing work

**Files:**
- Modify: `src/lib/admin/guard.ts`, `src/lib/admin/session.ts` and `src/app/admin/actions.ts` (the `fail` mapping)
- Create: `src/components/admin/SessionExpiredDialog.tsx` and `src/lib/admin/action-errors.ts` (client helper)
- Modify: every caller that shows `toast.error(result.error)`, routed through the helper
- Test: `tests/unit/admin-guard.test.ts`, `tests/unit/admin-actions.test.ts`, `tests/unit/session-expired.test.tsx`

**Interfaces:**
- **`adminGuard`:** returns `NextResponse.next(...)` with refreshed cookies for requests that have a `next-action` header, even without a session. Page requests behave as before.
- **`requireAdmin`:** throws `Error("SESSION_EXPIRED")` when there is no user, and `Error("FORBIDDEN")` when there is a user who is not the admin.
- **`ActionResult` failure:** gains `code?: "SESSION_EXPIRED" | "FORBIDDEN" | "NETWORK"`.
- **`showActionError(result, retry?: () => void)`** in `action-errors.ts`:
  - `SESSION_EXPIRED` opens the dialog (global store: `useSyncExternalStore`).
  - `NETWORK`, or a thrown fetch error, shows `toast.error("Không kết nối được máy chủ", { action: { label: "Thử lại", onClick: retry } })`.
  - Anything else shows `toast.error(result.error)`.
- **`SessionExpiredDialog`** is mounted once in the `(panel)` layout. Title "Phiên đăng nhập đã hết hạn", body "Nội dung bạn đang sửa vẫn còn. Đăng nhập lại ở tab mới rồi bấm Lưu.", and a button "Đăng nhập lại" that opens `/admin/login?next=/admin` in a new tab.

- [ ] **Step 1: Failing tests**
  - **Guard:** a request with header `next-action: abc` and no session is not a redirect (status ≠ 307). A page request still redirects.
  - **Actions:** `requireAdmin` mocked to reject `SESSION_EXPIRED` makes `saveResource` return `{ ok: false, error: …, code: "SESSION_EXPIRED" }`.
  - **Component:** `showActionError({ ok: false, code: "SESSION_EXPIRED", error: "x" })` renders the dialog with the button.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement**
  - Also wrap action calls in the client helpers in try/catch so a thrown network error maps to `NETWORK` with a retry.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): sign in again without losing edits; retry after network errors`.

### Task 4: Connection banner and double-submit audit

**Files:**
- Create: `src/components/admin/ConnectionBanner.tsx`, mounted in the `(panel)` layout
- Modify: any write button missing `disabled={pending}`
- Test: `tests/unit/connection-banner.test.tsx`

**Interfaces:**
- **`ConnectionBanner`** shows a thin `role="status"` bar "Mất kết nối — thay đổi chưa được lưu" in two cases:
  - when `navigator.onLine` is false (it listens to `online`/`offline`);
  - when the `NETWORK` store from Task 3 is set.
- On `online`, the bar hides and calls `router.refresh()` once.

- [ ] **Step 1: Failing test.** Dispatch `offline` and the bar appears. Dispatch `online` and it disappears, and `refresh` is called.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** Then grep every `onClick` that calls an action. Each must be disabled while pending; ledger any you fix.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): offline banner and no double submits`.

### Task 5: Drafts

**Files:**
- Create: `src/lib/admin/drafts.ts` (pure, storage injected) and `src/components/admin/DraftBar.tsx`
- Modify: `FieldsForm` (save debounced at about 1 s, offer restore, clear on save)
- Test: `tests/unit/admin-drafts.test.ts`, `tests/unit/form-incoming.test.tsx`

**Interfaces:**
- `type Draft = { values: Record<string, unknown>; savedAt: string; baseSignature: string }`.
- `draftKey(table: string, id: string | "new"): string` returns `admin.draft.${table}.${id}`.
- `saveDraft(storage, key, draft)`, `readDraft(storage, key, maxAgeDays = 7): Draft | null` (it removes expired drafts), `clearDraft(storage, key)`, and `pruneDrafts(storage, now)`.
- **`DraftBar`** text: "Có bản nháp chưa lưu lúc HH:mm — Khôi phục / Bỏ".
  - It appears only when the draft values differ from `initial`.
  - When `baseSignature` differs from the current server signature, it adds "(dữ liệu đã thay đổi kể từ bản nháp)".
  - Restore does `form.reset({ ...initial, ...draft.values })`.

- [ ] **Step 1: Failing tests**
  - Round trip of save and read.
  - Expiry after 7 days.
  - A form with a stored draft shows the bar, and "Khôi phục" puts the draft name in the input.
  - A successful save clears the draft.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** Skip upload fields' file objects and store URLs only. Wrap every storage call in try/catch.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): autosaved drafts with restore`.

### Task 6: Realtime across tabs (private broadcast)

**Files:**
- Modify: `src/lib/data/schema-sql.ts` (export `REALTIME_SQL`, appended to `renderSchemaSql()`)
- Create: `supabase/migrations/0006_admin_realtime.sql` and `src/components/admin/RealtimeSync.tsx`, mounted in the `(panel)` layout
- Create: `src/lib/admin/own-writes.ts` (a module store: `markOwnWrite()` and `isRecentOwnWrite(now)`, with a window of 3 s after the action settles)
- Modify: `FieldsForm` (deleted-elsewhere bar and refresh hold)
- Test: `tests/unit/db-schema.test.ts`, `tests/unit/realtime-sync.test.tsx`, `tests/unit/form-incoming.test.tsx`

**Interfaces:**
- **`REALTIME_SQL`:**
  - **`private.broadcast_content_change()` trigger function:** `security definer`, `set search_path = ''`, runs `after insert or update or delete for each row` on the 10 content tables. It calls `realtime.send(jsonb_build_object('table', tg_table_name, 'op', lower(tg_op), 'key', coalesce(row->>'id', row->>'key', row->>'skill_id')), 'change', 'admin:content', true)`.
  - **Policy:** `create policy "admin_content_receive" on realtime.messages for select to authenticated using (realtime.topic() = 'admin:content' and private.is_admin());`.
  - **Grants:** revoke execute on the trigger function from public, anon and authenticated.
- **`RealtimeSync`:**
  - It calls `createBrowserSupabase()` and `await supabase.realtime.setAuth()`, then opens `channel('admin:content', { config: { private: true } }).on('broadcast', { event: 'change' }, handle)`.
  - `handle` debounces by 400 ms, then runs `router.refresh()`. If the batch had no event inside `isRecentOwnWrite`, it also shows `toast("Đã cập nhật từ nơi khác")`.
  - On re-subscribe after `CHANNEL_ERROR`/`CLOSED`, it calls `router.refresh()` once.
  - It publishes the last events (`{table, key, op}`) through a small store so forms can react.
- **Form reaction:** `FieldsForm` with `table`/`itemKey` props, when it sees a `delete` event for its own item while dirty, shows the bar "Mục này đã bị xóa ở nơi khác" with three buttons:
  - "Khôi phục rồi lưu bản của tôi": `undoDelete` then `onSave`;
  - "Lưu thành mục mới": `saveResource(key, values, true)` with `copyId` when the id is taken;
  - "Về danh sách".
  - When it is not dirty, it goes to the list with `toast("Mục đã bị xóa ở nơi khác")`.
- **Page side (decided):** the refresh would 404 the editor once its item is gone, so a dirty form protects itself instead.
  - `own-writes.ts` also exports `holdRefresh(path: string, on: boolean)` and `isRefreshHeld(path)`.
  - While a dirty form exists, it holds its own route.
  - `RealtimeSync` skips `router.refresh()` while the current pathname is held. It still delivers events to the form, so the form shows "Có bản mới hơn" or the deleted bar.
  - The page keeps calling `notFound()` for normal navigation.

- [ ] **Step 1: Failing tests**
  - **`db-schema.test.ts`:**
    - `REALTIME_SQL` contains `realtime.send(`, `'admin:content'`, the policy line, and 10 `create trigger <t>_broadcast after insert or update or delete on public.<t>` lines;
    - the migration file contains `REALTIME_SQL`.
  - **`realtime-sync.test.tsx`** (mock `createBrowserSupabase` with a fake channel that captures the handler):
    - two events within 400 ms cause one `refresh`, and a toast is shown;
    - after `markOwnWrite()`, an event refreshes without a toast.
  - **`form-incoming.test.tsx`:** a dirty form receiving a delete event for its item shows the deleted bar with three buttons.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement**
  - Every client action call site calls `markOwnWrite()` before awaiting. Put this in the Task 3 helper `runAction(fn)`, which also does the error mapping.
  - Then apply the migration, using MCP or the owner.
  - Check, read-only:
    - `pg_trigger` has 10 `_broadcast` triggers;
    - the policy exists;
    - advisor shows no new WARN.
- [ ] **Step 4:** Run `npm run verify`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): live updates across tabs through a private channel`.

### Task 7: Finish

- [ ] **Real check in the browser pane** (dev server):
  - create `test-item`; it appears in the list highlighted, without a reload;
  - two tabs: edit in tab A, and tab B updates with a toast;
  - go offline: the banner shows, and it hides when back online.
- [ ] Final whole-branch review on the most capable model, then ONE fix pass.
- [ ] PR with:
  - rollback SQL (`drop policy "admin_content_receive" on realtime.messages; drop trigger <t>_broadcast …; drop function private.broadcast_content_change();`);
  - a preview checklist that includes the two-tab and offline steps.
- [ ] Turn on Auto-fix and wait for the owner.
