-- Batch 5: additive admin SELECT only. Storage tables and buckets stay as configured.
-- Read-only verification: docs/admin-media-storage.sql.
-- Explicit rollback: docs/admin-media-storage-rollback.sql.

-- Only admins may list objects in the media library buckets.
create policy "admin_media_select" on storage.objects for select to authenticated using (bucket_id in ('media', 'files') and private.is_admin());
