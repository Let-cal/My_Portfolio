# Admin media library — operations and preview checklist

## Scope

`/admin/media` lists the `media` and `files` Storage buckets through the signed-in admin session. It includes nested folders and paginated objects; reference checks include hidden current content. A failed or oversized inventory is an error, not a partial list of supposedly unused files.

Search names/paths, filter by type or unused files, and open original files in a new tab. Image thumbnails load lazily; videos and PDFs use icons. The picker in upload fields keeps the existing image/video/PDF size and MIME limits and only changes the unsaved form value. Save the form to publish the selection.

The usage indicator compares known bytes in these two buckets to a **1 GB reference**. It is not the project's billing/quota measurement; other buckets and unknown object sizes are excluded and labelled. Built-in `/public/` assets and external URLs are not listed.

## Additive migration

Preview and production share a database. Apply only this migration to the existing project; do not rerun the full generated schema or seed it again:

1. Confirm the intended project is the existing Letcal portfolio project.
2. Run the read-only queries in [admin-media-storage.sql](admin-media-storage.sql) and retain the policy snapshot. Confirm no conflicting existing policy grants broader listing access.
3. Apply [20261021124334_admin_media_select.sql](../supabase/migrations/20261021124334_admin_media_select.sql). It adds only `admin_media_select`: SELECT to `authenticated` for `media`/`files`, requiring `private.is_admin()`.
4. Rerun the verification queries. Confirm the one added policy, existing RLS, helper permissions and unchanged previous policies.
5. Check real Storage listing using existing admin, non-admin and anonymous sessions. Only the admin may list these buckets; public URLs for known files stay readable. A denied SELECT can look like an empty list, so an empty grid alone does not prove that the policy is installed.
6. Run Supabase's security advisor and compare findings to the pre-migration baseline. The migration must introduce no new warnings.

The checked-in SQL and mocked tests are not evidence that a remote migration or advisor check ran. Record execution results in the PR.

**Rollback:** [admin-media-storage-rollback.sql](admin-media-storage-rollback.sql) drops only the added policy. It does not delete files or content. The library cannot list files without its SELECT permission. Rerun the read-only catalog checks after rollback.

## Deletion contract

Only files absent from current saved content have a delete button. The server re-reads all current references before removing exactly the requested key. Out-of-scope buckets, invalid paths, missing files, unreadable content and used files are rejected.

Deletion is irreversible. Content history and local drafts may still reference a file even if no current row uses it. Storage removal and a concurrent content save are separate operations; this is not an atomic lock across tabs. Finish editing in other tabs before deletion. There is no bulk delete or undo.

## Owner preview checklist

Use disposable files and a hidden `test-item` certificate. Never remove a real portfolio asset to test this feature.

- [ ] Anonymous `/admin/media` goes to login, preserving the return URL; page stays `noindex`.
- [ ] Admin sees existing nested files, type, size, upload date, thumbnails/icons and the scoped usage indicator.
- [ ] Search, type and unused filters combine; reload recovers after a listing error.
- [ ] In a form, open **Chọn từ thư viện**; only the requested type is offered. Oversized/unknown-size files cannot be selected. Cancel/Escape preserves the original value and returns focus. Choose updates the form without uploading or saving automatically.
- [ ] Save a disposable uploaded file on the hidden `test-item`. The library shows its usage link and offers no delete button. Hidden content counts as used.
- [ ] Remove that reference and save. The disposable file becomes unused. Cancel deletion once, then confirm; pending buttons prevent repeated requests. Verify the file actually disappears.
- [ ] Simulate a new saved reference from another tab before confirming deletion; server refuses to delete the now-used file. Reload shows its current usage.
- [ ] Sign out elsewhere, then load/select/delete here: session-expired UI appears and unsaved form content remains.
- [ ] Review desktop/mobile and light/dark layouts, keyboard focus and dialog scrolling.
- [ ] Remove only the disposable test content/files; confirm real assets remain untouched.
