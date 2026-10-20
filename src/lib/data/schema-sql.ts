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

function storageSql(): string {
  const list = BUCKETS.map((b) => `'${b}'`).join(", ");
  return [
    "-- Public read for uploaded media and files; only admins may write.",
    `insert into storage.buckets (id, name, public) values ${BUCKETS.map((b) => `('${b}', '${b}', true)`).join(", ")}`,
    "  on conflict (id) do update set public = excluded.public;",
    `create policy "admin_upload" on storage.objects for insert to authenticated with check (bucket_id in (${list}) and private.is_admin());`,
    `create policy "admin_update" on storage.objects for update to authenticated using (bucket_id in (${list}) and private.is_admin());`,
    `create policy "admin_delete" on storage.objects for delete to authenticated using (bucket_id in (${list}) and private.is_admin());`,
  ].join("\n");
}

/** The full current schema. Tests compare it with supabase/schema.sql. */
export function renderSchemaSql(): string {
  const tables = Object.entries(TABLES).map(([name, table]) =>
    tableSql(name, table),
  );
  return [HEADER, ...tables, storageSql()].join("\n\n") + "\n";
}
