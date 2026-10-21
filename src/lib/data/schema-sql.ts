import { BUCKETS, TABLES, type Column, type Table } from "./columns";

function columnSql(col: Column): string {
  return [
    `  ${col.name} ${col.type}`,
    col.nullable ? "" : " not null",
    col.default ? ` default ${col.default}` : "",
    col.constraint ? ` ${col.constraint}` : "",
  ].join("");
}

function tableSql(name: string, table: Table): string {
  const lines = [
    ...table.columns.map(columnSql),
    "  created_at timestamptz not null default now()",
    "  updated_at timestamptz not null default now()",
    ...(table.tableConstraints ?? []).map((c) => `  ${c}`),
  ];
  const readable = table.hasPublished
    ? "published or private.is_admin()"
    : "true";
  return [
    `create table public.${name} (\n${lines.join(",\n")}\n);`,
    `create trigger ${name}_updated_at before update on public.${name} for each row execute function public.set_updated_at();`,
    `alter table public.${name} enable row level security;`,
    `create policy "${name}_read" on public.${name} for select to anon, authenticated using (${readable});`,
    `create policy "${name}_write" on public.${name} for all to authenticated using (private.is_admin()) with check (private.is_admin());`,
  ].join("\n");
}

const HEADER = `-- Current schema, generated from src/lib/data/columns.ts by \`npm run db:schema\`.
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
grant execute on function private.is_admin() to anon, authenticated;`;

/** Batch 5: admin listing, mirrored in 20261021124334_admin_media_select.sql. */
export const ADMIN_MEDIA_SELECT_SQL = `-- Only admins may list objects in the media library buckets.
create policy "admin_media_select" on storage.objects for select to authenticated using (bucket_id in ('media', 'files') and private.is_admin());`;

function storageSql(): string {
  const list = BUCKETS.map((b) => `'${b}'`).join(", ");
  return [
    "-- Public read for uploaded media and files; only admins may write.",
    `insert into storage.buckets (id, name, public) values ${BUCKETS.map((b) => `('${b}', '${b}', true)`).join(", ")}`,
    "  on conflict (id) do update set public = excluded.public;",
    `create policy "admin_upload" on storage.objects for insert to authenticated with check (bucket_id in (${list}) and private.is_admin());`,
    `create policy "admin_update" on storage.objects for update to authenticated using (bucket_id in (${list}) and private.is_admin());`,
    `create policy "admin_delete" on storage.objects for delete to authenticated using (bucket_id in (${list}) and private.is_admin());`,
    ADMIN_MEDIA_SELECT_SQL,
  ].join("\n");
}

/** The full current schema. Tests compare it with supabase/schema.sql. */
export function renderSchemaSql(): string {
  const tables = Object.entries(TABLES).map(([name, table]) =>
    tableSql(name, table),
  );
  return (
    [
      HEADER,
      ...tables,
      storageSql(),
      VERSIONS_SQL,
      VERSIONS_SECURITY_SQL,
      REALTIME_SQL,
    ].join("\n\n") + "\n"
  );
}

/** Every content table keeps a history of old rows (batch 3: undo and restore). */
export const VERSIONED_TABLES = Object.keys(TABLES) as (keyof typeof TABLES)[];

const tableList = VERSIONED_TABLES.map((t) => `'${t}'`).join(", ");

/**
 * Content history (supabase/migrations/0004_content_versions.sql). Updates and deletes keep the
 * old row; admins list and restore through two security-definer functions, nobody else can.
 */
export const VERSIONS_SQL = `-- Content history: each update or delete keeps the old row, so the admin can see and undo changes.
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

${VERSIONED_TABLES.map(
  (t) =>
    `create trigger ${t}_version after update or delete on public.${t} for each row execute function private.record_version();`,
).join("\n")}

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
  if v.table_name not in (${tableList}) or v.table_name = 'skill_links' then
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
grant execute on function public.admin_restore_version(bigint) to authenticated;`;

/**
 * supabase/migrations/0005_versions_security_invoker.sql (Supabase lint 0029). The history
 * functions run with the caller's rights instead of the owner's: reading history goes through an
 * admin-only RLS policy, and a restore writes through the existing admin-only write policies.
 * Their own is_admin() check stays as a clear error for everyone else.
 */
export const VERSIONS_SECURITY_SQL = `-- History functions run with the caller's rights; only admins may read the history table.
alter function public.admin_list_versions(text, text) security invoker;
alter function public.admin_restore_version(bigint) security invoker;
grant select on private.content_versions to authenticated;
create policy "content_versions_admin_read" on private.content_versions for select to authenticated using (private.is_admin());`;

/**
 * supabase/migrations/0006_admin_realtime.sql. Every content change sends a tiny note
 * (table, operation, key; never the row) on the private topic `admin:content`, which only the
 * admin may receive. Open admin tabs and devices refresh on it. A failed send never blocks a save.
 */
export const REALTIME_SQL = `-- Live admin updates: a change note on a private Realtime topic only the admin can receive.
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

${VERSIONED_TABLES.map(
  (t) =>
    `create trigger ${t}_broadcast after insert or update or delete on public.${t} for each row execute function private.broadcast_content_change();`,
).join("\n")}

create policy "admin_content_receive" on realtime.messages for select to authenticated using (realtime.topic() = 'admin:content' and private.is_admin());`;
