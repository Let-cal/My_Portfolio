-- Explicit manual rollback for 20261021141852_admin_media_select.sql only.
-- Not executed by implementation. Removes only the added admin listing policy.
-- Recheck docs/admin-media-storage.sql afterward; the policy row must be absent.
drop policy if exists "admin_media_select" on storage.objects;
