-- Batch 5 Storage policy verification. READ ONLY.
-- Remote execution results: docs/admin-media-verification-2026-10-21.md.
-- The parent/owner runs these checks before and after applying
-- supabase/migrations/20261021141852_admin_media_select.sql separately.
-- This file does not apply the migration or change roles, JWTs, buckets or objects.
-- Reference: https://supabase.com/docs/guides/storage/security/access-control

-- 1. Catalog snapshot: review ALL existing policies, especially SELECT / ALL.
-- Permissive policies combine with OR; another policy can independently allow access.
-- Expect only the new admin_media_select row to differ from the pre-migration snapshot.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- 2. Before application: zero rows. After: one PERMISSIVE / SELECT row, roles
-- {authenticated}, with_check NULL. Inspect qual for BOTH bucket_id restricted to
-- media/files AND private.is_admin(). PostgreSQL may render IN as ANY(ARRAY[...]).
-- Neither anon nor public should be a target role of this policy.
select policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname = 'admin_media_select';

-- 3. Confirm Storage RLS is already enabled (relrowsecurity = true).
-- This migration deliberately contains no ALTER TABLE.
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity, c.relforcerowsecurity
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'storage' and c.relname = 'objects';

-- 4. Check the existing helper and caller privileges without changing them.
-- Expect is_admin(), boolean, stable; authenticated can use private and execute it.
select n.nspname as schema_name, p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
       pg_catalog.pg_get_function_result(p.oid) as result,
       p.provolatile, p.prosecdef, p.proconfig,
       pg_catalog.has_schema_privilege('authenticated', n.oid, 'USAGE') as can_use_schema,
       pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as can_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private' and p.proname = 'is_admin' and p.pronargs = 0;

-- Catalog checks do not prove session behavior. Parent verification still needs
-- existing authenticated admin/non-admin and anonymous sessions through Storage:
-- admin can list media/files (including nested paths); non-admin and anonymous
-- sessions see no object listings; an admin gains no access to other buckets.
-- A denied SELECT may return an empty list rather than a permission error.
-- Public URLs for known objects in public buckets remain publicly readable.
-- No real upload, delete or content edits are needed to verify listing.
-- After an explicit rollback, rerun checks 1-2: admin_media_select must be absent,
-- and every pre-existing policy must match the original catalog snapshot.
