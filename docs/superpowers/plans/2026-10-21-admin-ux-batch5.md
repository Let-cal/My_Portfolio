# Admin batch 5: media library implementation plan

> **For agentic workers:** Use superpowers:executing-plans for the approved spec, one PR for this batch.

**Spec:** docs/superpowers/specs/2026-10-19-admin-ux-design.md, Batch5 F.
**Goal:** Browse existing Storage files, understand current references, safely remove unused files and choose existing files in upload fields.
**Architecture:** Admin-only server actions use the cookie client, never service-role keys. Exhaustive paginated folder traversal of media/files fails rather than reporting partial results. A pure canonical URL index includes hidden current content. Delete re-reads references and refuses used/missing/out-of-scope files before the Storage API. Shared client browser drives the management grid and filtered picker; selection changes only the form until saved.
**Stack:** Existing Next16/React19/Supabase/shadcn/Tailwind, no new package or paid service.

## Constraints and calls
- Branch feat/admin-media-library from merged PR14 7bd27ee. Preserve user probe and processes.
- Only additive admin SELECT policy; no public listing or service-role bypass, no storage schema/table alterations. Generate migration through CLI and mirror in schema-sql.ts. Apply through authenticated Supabase tools if available; otherwise produce concrete SQL/checks before requesting connection.
- Sidebar/command palette link. Responsive token-based image grid, text-labelled type/usage filters, lazy reserved thumbnails, keyboard focus, explicit irreversible-delete dialog. No autoplay videos/PDF embeds or bulk destructive actions.
- Quota is known bytes in these two buckets against a 1GB reference; unknown metadata and other buckets are not represented as zero usage.
- Filename/path/MIME/size validation; type-limited picker respects existing upload rules. Built-in public assets excluded.
- Current references checked immediately before removal, including hidden items. Historical versions/drafts are not current uses; deletion has no undo and may break old references. Storage and content APIs cannot offer a single atomic delete transaction; document concurrent edits risk.
- Do not delete real files or change real content during tests. Preview uses production DB. Real policy verification/advisor and owner review are separate from mocked tests.

## Task 1: Storage model and actions
- [x] RED tests: URL canonicalization/usage, nested pagination/unknown sizes, expired-session, in-use, bad paths and listing failure refuse delete.
- [x] Implement pure media.ts, guarded list/delete in media-actions.ts with session error mapping and read-only runAction option.
- [x] Add admin SELECT migration, generated schema and verification/rollback SQL.

## Task 2: Media browser and picker
- [x] RED component tests: loading/error, filters, picker type limits, choose without upload/save, delete confirmation and pending guards.
- [x] Implement shared MediaBrowser and picker dialog, /admin/media page and sidebar/palette integration; integrate picker into UploadField.
- [x] Generate icon artifacts and verify types/lint.

## Task 3: Validate and deliver
- [ ] Apply/verify additive policy using existing authorized project connection; no fabricated execution results.
- [x] npm run verify, anonymous browser checks, independent whole-patch review and important-finding fix pass.
- [x] Commit/push/open batch5 PR with migration state, rollback and test-item-only owner checklist. Owner controls merge.

## Verification record — 2026-10-21

- `npm run verify`: passed. Formatting, generated assets, lint (0 errors; existing React Hook Form compiler warning in ResourceForm), types, 120 test files / 1,253 tests, production build, initial JS budgets (198.6 KB gzip per locale), 50 budget/script tests.
- Production server on owned port 4327: Playwright `admin.spec.ts`, 5/5 passed, including anonymous `/admin/media` redirect + return path + noindex. No authenticated browser session or destructive real-file test was used.
- Fresh whole-patch review: one Important issue fixed (re-read complete references after Storage traversal, immediately before removal), plus two Minor issues fixed (delete-dialog focus restoration and bounded scrolling). Added RED→GREEN regression tests for the fixes and final-read failure. Known non-atomic concurrent-save limitation remains explicit in the UI/runbook.
- Opt-in complete content pagination covers later/hidden rows; existing callers retain their current default behavior. Read-only actions no longer suppress other-tab Realtime notes.
- Integration regression found by the full suite: command-palette search matched overbroad new keywords. Scoped the media keywords and retained the previous default screen ordering; existing navigation regression is green.
- Ruling: one bounded database-policy worker ran alongside inline UI implementation, following the user's previously authorized subagent workflow. The worker had a disjoint write set; one fresh reviewer evaluated the integrated patch.
- **Remote gate remains pending:** no Supabase management connection in this session. CLI returned `AccessTokenRequiredError`; no migration, advisor, or real RLS/session check has been executed. Prepared exact migration, read-only verification and policy-only rollback. Keep the delivery PR draft until those checks and owner preview review are complete. Mocked tests are not remote execution evidence.
- Delivery: implementation commit `c539514`, branch `feat/admin-media-library`, [draft PR #15](https://github.com/Let-cal/My_Portfolio/pull/15). GitHub checks and Vercel preview started; their final outcomes must be checked against the current PR head before marking ready. Production and main have not been changed by this batch.
