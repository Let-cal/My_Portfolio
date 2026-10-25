-- Task 5: read-only reviewer. Additive (new table, functions, SELECT policies) except that
-- admin_list_versions is replaced to also admit the reviewer. Rollback: docs/security/reviewer-access.md.

-- Read-only reviewer: may read everything an editor sees, may change nothing.
create table private.app_reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.app_reviewers enable row level security;
revoke all on private.app_reviewers from public, anon, authenticated;

create or replace function private.is_reviewer() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.app_reviewers r
    where r.user_id = auth.uid()
  );
$$;
revoke execute on function private.is_reviewer() from public, anon;
grant execute on function private.is_reviewer() to authenticated;

-- Which admin role the caller has: 'admin', 'reviewer' or null.
create or replace function public.admin_access_kind() returns text
language sql stable security invoker set search_path = '' as $$
  select case
    when private.is_admin() then 'admin'
    when private.is_reviewer() then 'reviewer'
  end;
$$;
revoke execute on function public.admin_access_kind() from public, anon;
grant execute on function public.admin_access_kind() to authenticated;

create policy "profile_reviewer_read" on public.profile for select to authenticated using (private.is_reviewer());
create policy "roles_reviewer_read" on public.roles for select to authenticated using (private.is_reviewer());
create policy "experiences_reviewer_read" on public.experiences for select to authenticated using (private.is_reviewer());
create policy "projects_reviewer_read" on public.projects for select to authenticated using (private.is_reviewer());
create policy "skills_reviewer_read" on public.skills for select to authenticated using (private.is_reviewer());
create policy "skill_links_reviewer_read" on public.skill_links for select to authenticated using (private.is_reviewer());
create policy "certificates_reviewer_read" on public.certificates for select to authenticated using (private.is_reviewer());
create policy "activities_reviewer_read" on public.activities for select to authenticated using (private.is_reviewer());
create policy "education_reviewer_read" on public.education for select to authenticated using (private.is_reviewer());
create policy "why_cards_reviewer_read" on public.why_cards for select to authenticated using (private.is_reviewer());

create policy "reviewer_media_select" on storage.objects for select to authenticated using (bucket_id in ('media', 'files') and private.is_reviewer());

create policy "content_versions_reviewer_read" on private.content_versions for select to authenticated using (private.is_reviewer());

-- History may be listed by the reviewer too; restoring a version stays admin-only.
create or replace function public.admin_list_versions(p_table text, p_key text)
returns table (id bigint, op text, old_row jsonb, changed_by text, changed_at timestamptz)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not (private.is_admin() or private.is_reviewer()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select v.id, v.op, v.old_row, v.changed_by, v.changed_at
    from private.content_versions v
    where v.table_name = p_table and v.item_key = p_key
    order by v.id desc
    limit 50;
end;
$$;

create policy "reviewer_content_receive" on realtime.messages for select to authenticated using (realtime.topic() = 'admin:content' and private.is_reviewer());
