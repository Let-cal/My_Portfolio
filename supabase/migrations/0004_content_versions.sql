-- Batch 3: content history for undo and restore. Additive: new table, functions and triggers only.
-- Rollback: drop the 10 <table>_version triggers, then
--   drop function public.admin_restore_version(bigint), public.admin_list_versions(text, text), private.record_version();
--   drop table private.content_versions;

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
         string_agg(format('%1$I = excluded.%1$I', c.column_name), ', ' order by c.ordinal_position)
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
