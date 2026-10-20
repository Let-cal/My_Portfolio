-- Batch 3 follow-up for Supabase lint 0029 (signed-in users can execute SECURITY DEFINER functions).
-- Additive: changes two functions to SECURITY INVOKER and adds an admin-only read policy.
-- Rollback:
--   alter function public.admin_list_versions(text, text) security definer;
--   alter function public.admin_restore_version(bigint) security definer;
--   drop policy "content_versions_admin_read" on private.content_versions;
--   revoke select on private.content_versions from authenticated;

-- History functions run with the caller's rights; only admins may read the history table.
alter function public.admin_list_versions(text, text) security invoker;
alter function public.admin_restore_version(bigint) security invoker;
grant select on private.content_versions to authenticated;
create policy "content_versions_admin_read" on private.content_versions for select to authenticated using (private.is_admin());
