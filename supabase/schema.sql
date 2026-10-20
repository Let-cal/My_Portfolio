-- Current schema, generated from src/lib/data/columns.ts by `npm run db:schema`.
-- Do not edit by hand. Changes to a live database go in supabase/migrations/.

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- A reorder only moves sort_index; it is not an edit, so "last edited" keeps its time.
  if (to_jsonb(new) - 'sort_index' - 'updated_at') = (to_jsonb(old) - 'sort_index' - 'updated_at') then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;

-- Admin checks live in a private schema that the Data API does not expose.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- Admins are listed by email; only the service role can read or change this table.
create table private.app_admins (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table private.app_admins enable row level security;
revoke all on private.app_admins from public, anon, authenticated;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.app_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

create table public.profile (
  id text not null default 'me' primary key check (id = 'me'),
  name text not null,
  location text not null,
  email text not null,
  linkedin text not null,
  github text not null,
  avatar_url text,
  open_to_work boolean not null default true,
  availability_note jsonb not null,
  booking_url text,
  summaries jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profile_updated_at before update on public.profile for each row execute function public.set_updated_at();
alter table public.profile enable row level security;
create policy "profile_read" on public.profile for select to anon, authenticated using (true);
create policy "profile_write" on public.profile for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.roles (
  key text not null primary key,
  title jsonb not null,
  koi_variety text not null,
  cv_file_url text not null,
  experience_order text[] not null default '{}',
  skill_group_order text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger roles_updated_at before update on public.roles for each row execute function public.set_updated_at();
alter table public.roles enable row level security;
create policy "roles_read" on public.roles for select to anon, authenticated using (true);
create policy "roles_write" on public.roles for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.experiences (
  id text not null primary key,
  company text not null,
  parent_company text,
  location text not null,
  position jsonb not null,
  start_month text not null,
  end_month text,
  employment_type text not null,
  summary jsonb not null,
  case_study jsonb,
  team_size text,
  tech text[] not null default '{}',
  links jsonb not null default '[]',
  published boolean not null default true,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger experiences_updated_at before update on public.experiences for each row execute function public.set_updated_at();
alter table public.experiences enable row level security;
create policy "experiences_read" on public.experiences for select to anon, authenticated using (published or private.is_admin());
create policy "experiences_write" on public.experiences for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.projects (
  id text not null primary key,
  title text not null,
  role jsonb not null,
  start_month text not null,
  end_month text,
  summary jsonb not null,
  case_study jsonb,
  tech text[] not null default '{}',
  demo_url text,
  repo_urls text[] not null default '{}',
  poster_url text,
  video_url text,
  published boolean not null default true,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
alter table public.projects enable row level security;
create policy "projects_read" on public.projects for select to anon, authenticated using (published or private.is_admin());
create policy "projects_write" on public.projects for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.skills (
  id text not null primary key,
  name text not null,
  skill_group text not null,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger skills_updated_at before update on public.skills for each row execute function public.set_updated_at();
alter table public.skills enable row level security;
create policy "skills_read" on public.skills for select to anon, authenticated using (true);
create policy "skills_write" on public.skills for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.skill_links (
  skill_id text not null references public.skills (id) on delete cascade,
  experience_id text references public.experiences (id) on delete cascade,
  project_id text references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((experience_id is null) <> (project_id is null)),
  unique nulls not distinct (skill_id, experience_id, project_id)
);
create trigger skill_links_updated_at before update on public.skill_links for each row execute function public.set_updated_at();
alter table public.skill_links enable row level security;
create policy "skill_links_read" on public.skill_links for select to anon, authenticated using (true);
create policy "skill_links_write" on public.skill_links for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.certificates (
  id text not null primary key,
  name text not null,
  organization text not null,
  issue_date text not null,
  credential_id text,
  credential_url text,
  file_url text,
  topic text not null,
  skills text[] not null default '{}',
  description jsonb not null,
  published boolean not null default true,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger certificates_updated_at before update on public.certificates for each row execute function public.set_updated_at();
alter table public.certificates enable row level security;
create policy "certificates_read" on public.certificates for select to anon, authenticated using (published or private.is_admin());
create policy "certificates_write" on public.certificates for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.activities (
  id text not null primary key,
  name jsonb not null,
  event_date text not null,
  skills text[] not null default '{}',
  description jsonb not null,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger activities_updated_at before update on public.activities for each row execute function public.set_updated_at();
alter table public.activities enable row level security;
create policy "activities_read" on public.activities for select to anon, authenticated using (true);
create policy "activities_write" on public.activities for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.education (
  id text not null primary key,
  school text not null,
  degree jsonb not null,
  major jsonb not null,
  start_month text not null,
  end_month text,
  gpa text,
  notes jsonb,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger education_updated_at before update on public.education for each row execute function public.set_updated_at();
alter table public.education enable row level security;
create policy "education_read" on public.education for select to anon, authenticated using (true);
create policy "education_write" on public.education for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.why_cards (
  id text not null primary key,
  title jsonb not null,
  subtitle jsonb not null,
  tag jsonb not null,
  body jsonb not null,
  colors text[] not null,
  evidence_link text,
  stat jsonb,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger why_cards_updated_at before update on public.why_cards for each row execute function public.set_updated_at();
alter table public.why_cards enable row level security;
create policy "why_cards_read" on public.why_cards for select to anon, authenticated using (true);
create policy "why_cards_write" on public.why_cards for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Public read for uploaded media and files; only admins may write.
insert into storage.buckets (id, name, public) values ('media', 'media', true), ('files', 'files', true)
  on conflict (id) do update set public = excluded.public;
create policy "admin_upload" on storage.objects for insert to authenticated with check (bucket_id in ('media', 'files') and private.is_admin());
create policy "admin_update" on storage.objects for update to authenticated using (bucket_id in ('media', 'files') and private.is_admin());
create policy "admin_delete" on storage.objects for delete to authenticated using (bucket_id in ('media', 'files') and private.is_admin());

-- Content history: each update or delete keeps the old row, so the admin can see and undo changes.
create table private.content_versions (
  id bigint generated always as identity primary key,
  table_name text not null,
  item_key text not null,
  op text not null check (op in ('update', 'delete')),
  old_row jsonb not null,
  changed_by text,
  changed_at timestamptz not null default now(),
  txid bigint not null default txid_current()
);
create index content_versions_item on private.content_versions (table_name, item_key, id desc);
create index content_versions_txid on private.content_versions (txid);
alter table private.content_versions enable row level security;
revoke all on private.content_versions from public, anon, authenticated;

-- Reorders (sort_index only) are not edits; skill links only matter when deleted (undo restores them).
-- Each item keeps its newest 50 versions.
create or replace function private.record_version() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb := to_jsonb(old);
  item text := coalesce(old_row ->> 'id', old_row ->> 'key', old_row ->> 'skill_id');
begin
  if tg_op = 'UPDATE' then
    if tg_table_name = 'skill_links'
      or (to_jsonb(new) - 'sort_index' - 'updated_at') = (old_row - 'sort_index' - 'updated_at') then
      return null;
    end if;
  end if;
  insert into private.content_versions (table_name, item_key, op, old_row, changed_by)
  values (tg_table_name, item, lower(tg_op), old_row, auth.jwt() ->> 'email');
  delete from private.content_versions
  where id in (
    select v.id from private.content_versions v
    where v.table_name = tg_table_name and v.item_key = item
    order by v.id desc offset 50
  );
  return null;
end;
$$;
revoke execute on function private.record_version() from public, anon, authenticated;

create trigger profile_version after update or delete on public.profile for each row execute function private.record_version();
create trigger roles_version after update or delete on public.roles for each row execute function private.record_version();
create trigger experiences_version after update or delete on public.experiences for each row execute function private.record_version();
create trigger projects_version after update or delete on public.projects for each row execute function private.record_version();
create trigger skills_version after update or delete on public.skills for each row execute function private.record_version();
create trigger skill_links_version after update or delete on public.skill_links for each row execute function private.record_version();
create trigger certificates_version after update or delete on public.certificates for each row execute function private.record_version();
create trigger activities_version after update or delete on public.activities for each row execute function private.record_version();
create trigger education_version after update or delete on public.education for each row execute function private.record_version();
create trigger why_cards_version after update or delete on public.why_cards for each row execute function private.record_version();

create or replace function public.admin_list_versions(p_table text, p_key text)
returns table (id bigint, op text, old_row jsonb, changed_by text, changed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
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

-- Restoring writes the old row back with an upsert (never delete + insert, which would cascade
-- away skill links), so a restore is itself a new version and can be undone. Restoring a delete
-- also brings back the skill links deleted in the same transaction, when both ends still exist.
create or replace function public.admin_restore_version(p_version_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v private.content_versions;
  pk text;
  cols text;
  sets text;
  link private.content_versions;
begin
  if not private.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v from private.content_versions where content_versions.id = p_version_id;
  if not found then
    raise exception 'version % not found', p_version_id;
  end if;
  if v.table_name not in ('profile', 'roles', 'experiences', 'projects', 'skills', 'skill_links', 'certificates', 'activities', 'education', 'why_cards') or v.table_name = 'skill_links' then
    raise exception 'cannot restore %', v.table_name;
  end if;
  pk := case v.table_name when 'roles' then 'key' else 'id' end;
  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         -- An edit restore keeps the current position: reorders write no version, so the old
         -- sort_index may be stale. A deleted item comes back at its old position (insert below).
         string_agg(format('%1$I = excluded.%1$I', c.column_name), ', ' order by c.ordinal_position)
           filter (where c.column_name <> 'sort_index')
    into cols, sets
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = v.table_name;
  if v.op = 'update' then
    execute format(
      'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) on conflict (%3$I) do update set %4$s',
      v.table_name, cols, pk, sets
    ) using v.old_row;
  else
    execute format(
      'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) on conflict (%3$I) do nothing',
      v.table_name, cols, pk
    ) using v.old_row;
    for link in
      select * from private.content_versions l
      where l.txid = v.txid and l.table_name = 'skill_links' and l.op = 'delete'
    loop
      insert into public.skill_links (skill_id, experience_id, project_id, created_at, updated_at)
      select r.skill_id, r.experience_id, r.project_id, r.created_at, r.updated_at
      from jsonb_populate_record(null::public.skill_links, link.old_row) r
      where exists (select 1 from public.skills s where s.id = r.skill_id)
        and (r.experience_id is null or exists (select 1 from public.experiences e where e.id = r.experience_id))
        and (r.project_id is null or exists (select 1 from public.projects p where p.id = r.project_id))
      on conflict do nothing;
    end loop;
  end if;
end;
$$;

revoke execute on function public.admin_list_versions(text, text) from public, anon;
grant execute on function public.admin_list_versions(text, text) to authenticated;
revoke execute on function public.admin_restore_version(bigint) from public, anon;
grant execute on function public.admin_restore_version(bigint) to authenticated;

-- History functions run with the caller's rights; only admins may read the history table.
alter function public.admin_list_versions(text, text) security invoker;
alter function public.admin_restore_version(bigint) security invoker;
grant select on private.content_versions to authenticated;
create policy "content_versions_admin_read" on private.content_versions for select to authenticated using (private.is_admin());

-- Live admin updates: a change note on a private Realtime topic only the admin can receive.
create or replace function private.broadcast_content_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  begin
    perform realtime.send(
      jsonb_build_object('table', tg_table_name, 'op', lower(tg_op), 'key', coalesce(r ->> 'id', r ->> 'key', r ->> 'skill_id')),
      'change',
      'admin:content',
      true
    );
  exception when others then
    -- Live updates are a convenience; the save itself must always go through.
    null;
  end;
  return null;
end;
$$;
revoke execute on function private.broadcast_content_change() from public, anon, authenticated;

create trigger profile_broadcast after insert or update or delete on public.profile for each row execute function private.broadcast_content_change();
create trigger roles_broadcast after insert or update or delete on public.roles for each row execute function private.broadcast_content_change();
create trigger experiences_broadcast after insert or update or delete on public.experiences for each row execute function private.broadcast_content_change();
create trigger projects_broadcast after insert or update or delete on public.projects for each row execute function private.broadcast_content_change();
create trigger skills_broadcast after insert or update or delete on public.skills for each row execute function private.broadcast_content_change();
create trigger skill_links_broadcast after insert or update or delete on public.skill_links for each row execute function private.broadcast_content_change();
create trigger certificates_broadcast after insert or update or delete on public.certificates for each row execute function private.broadcast_content_change();
create trigger activities_broadcast after insert or update or delete on public.activities for each row execute function private.broadcast_content_change();
create trigger education_broadcast after insert or update or delete on public.education for each row execute function private.broadcast_content_change();
create trigger why_cards_broadcast after insert or update or delete on public.why_cards for each row execute function private.broadcast_content_change();

create policy "admin_content_receive" on realtime.messages for select to authenticated using (realtime.topic() = 'admin:content' and private.is_admin());
