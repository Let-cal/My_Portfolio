-- Move the admin list and the admin check out of the Data API's public schema.
-- Policies reference is_admin() by OID, so they keep working after the move.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

alter table public.app_admins set schema private;
revoke all on private.app_admins from public, anon, authenticated;

alter function public.is_admin() set schema private;
-- The SQL body names its table, so point it at the moved table.
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.app_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;
