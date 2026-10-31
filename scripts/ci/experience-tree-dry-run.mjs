// Dry run of the experience tree migration on populated data, in a scratch database of the
// disposable stack (Linux CI only). Replays every earlier migration, loads the frozen
// pre-migration content, applies the migration and compares with seed.json, checks version
// restore, applies docs/experience-tree-rollback.sql and compares with the frozen content.
// Only stage names and "table/key.column" labels leave this module; never row values.

export const DRY_RUN_DATABASE = "experience_tree_dry_run";
export const TARGET_MIGRATION = /^\d{14}_experience_tree_projects\.sql$/;
export const ROLLBACK_FILE = "docs/experience-tree-rollback.sql";

/**
 * Minimal stand-ins for the Supabase-owned schemas the migrations reference (auth, storage,
 * realtime), so the project's migrations replay in a fresh database. auth.jwt() and auth.uid()
 * read the request claims like Supabase's own functions.
 */
export const STUBS_SQL = `create schema auth;
create table auth.users (id uuid primary key);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean);
create table storage.objects (id bigint generated always as identity primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
create schema realtime;
create table realtime.messages (id bigint generated always as identity primary key, topic text, payload jsonb);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$
  select nullif(current_setting('realtime.topic', true), '')
$$;
create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language plpgsql as $$ begin end $$;
`;

/** One JSON line: the compared tables without timestamps. */
export const SNAPSHOT_SQL = `select json_build_object(
  'experiences', (select coalesce(json_agg(to_jsonb(t) - 'created_at' - 'updated_at'), '[]') from public.experiences t),
  'projects', (select coalesce(json_agg(to_jsonb(t) - 'created_at' - 'updated_at'), '[]') from public.projects t),
  'skill_links', (select coalesce(json_agg(to_jsonb(t) - 'created_at' - 'updated_at'), '[]') from public.skill_links t),
  'why_cards', (select coalesce(json_agg(json_build_object('id', t.id, 'evidence_link', t.evidence_link)), '[]') from public.why_cards t),
  'roles', (select coalesce(json_agg(json_build_object('key', t.key, 'experience_order', t.experience_order)), '[]') from public.roles t)
);
`;

/**
 * As the admin: the pre-migration version of siteplus (from HISTORY_SQL, so it has none of the
 * new columns) restores and keeps the project's school, kind and star; a pre-migration-shaped delete version
 * restores with the column defaults; versions of the five moved experience rows are refused.
 * Raises on any failure, leaves the compared data as the migration left it.
 */
export const RESTORE_CHECK_SQL = `insert into private.app_admins (email) values ('dry-run-admin@example.invalid');
select set_config('request.jwt.claims', '{"email":"dry-run-admin@example.invalid","role":"authenticated"}', false);
do $$
declare
  v_id bigint;
  pre_row jsonb;
  refused int := 0;
  k text;
begin
  select id, old_row into v_id, pre_row from private.content_versions
  where table_name = 'projects' and item_key = 'siteplus' and not (old_row ? 'kind')
  order by id asc limit 1;
  if v_id is null then
    raise exception 'dry run: no pre-migration project version';
  end if;
  perform public.admin_restore_version(v_id);
  if not exists (
    select 1 from public.projects
    where id = 'siteplus' and kind = 'university' and education_id = 'fpt-university'
      and featured and featured_order = 1
  ) then
    raise exception 'dry run: edit restore lost the new project columns';
  end if;

  insert into private.content_versions (table_name, item_key, op, old_row)
  values ('projects', 'dry-run-deleted', 'delete', pre_row || '{"id": "dry-run-deleted"}');
  select max(id) into v_id from private.content_versions;
  perform public.admin_restore_version(v_id);
  if not exists (
    select 1 from public.projects
    where id = 'dry-run-deleted' and kind = 'personal' and not featured and roles = '{}' and links = '[]'
  ) then
    raise exception 'dry run: delete restore did not take the column defaults';
  end if;
  delete from public.projects where id = 'dry-run-deleted';

  foreach k in array array['skg-ai-agent', 'skg-flexybox-p2', 'skg-coa', 'skg-flexybox-p1', 'skg-intern'] loop
    select id into v_id from private.content_versions
    where table_name = 'experiences' and item_key = k order by id desc limit 1;
    begin
      perform public.admin_restore_version(v_id);
    exception when sqlstate '22023' then
      refused := refused + 1;
    end;
  end loop;
  if refused <> 5 then
    raise exception 'dry run: % of 5 moved-row versions refused', refused;
  end if;
end $$;
`;

/**
 * Before the migration: an edit and its undo on siteplus, so history holds versions without the
 * new columns (as on the hosted database). The data ends unchanged.
 */
export const HISTORY_SQL = `update public.projects set title = title || ' (draft)' where id = 'siteplus';
update public.projects set title = left(title, -length(' (draft)')) where id = 'siteplus';
`;

/** Earlier migrations in order, then the experience tree migration, which must be the last. */
export function splitMigrations(files) {
  const sorted = files.filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
  const targets = sorted.filter((f) => TARGET_MIGRATION.test(f));
  if (targets.length !== 1)
    throw new Error("Expected one experience tree migration");
  const index = sorted.indexOf(targets[0]);
  return { previous: sorted.slice(0, index), target: targets[0] };
}

const IGNORED = new Set(["created_at", "updated_at"]);
const KEYS = {
  experiences: (r) => r.id,
  projects: (r) => r.id,
  skill_links: (r) =>
    `${r.skill_id}|${r.experience_id ?? ""}|${r.project_id ?? ""}`,
  why_cards: (r) => r.id,
  roles: (r) => r.key,
};

/** JSON with sorted object keys, so key order never counts as a difference. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  return JSON.stringify(value ?? null);
}

const label = (text) => text.replace(/[^A-Za-z0-9_.:|/ -]/g, "?").slice(0, 120);

/** Differences as "table/key.column" labels (values never included). */
export function diffSnapshots(expected, actual) {
  const out = [];
  for (const [table, keyOf] of Object.entries(KEYS)) {
    const want = new Map((expected[table] ?? []).map((r) => [keyOf(r), r]));
    const have = new Map((actual?.[table] ?? []).map((r) => [keyOf(r), r]));
    for (const [key, row] of want) {
      const got = have.get(key);
      if (!got) {
        out.push(label(`${table}/${key}: missing`));
        continue;
      }
      const columns = new Set(
        [...Object.keys(row), ...Object.keys(got)].filter(
          (c) => !IGNORED.has(c),
        ),
      );
      for (const column of [...columns].sort()) {
        if (!(column in row))
          out.push(label(`${table}/${key}.${column}: unexpected column`));
        else if (!(column in got))
          out.push(label(`${table}/${key}.${column}: missing column`));
        else if (canonical(row[column]) !== canonical(got[column]))
          out.push(label(`${table}/${key}.${column}`));
      }
    }
    for (const key of have.keys())
      if (!want.has(key)) out.push(label(`${table}/${key}: unexpected`));
  }
  return out;
}

/**
 * Runs the dry run. `psql(sql, database)` runs a script and returns stdout (throws on error),
 * `read(path)` returns a repository file, `data` comes from print-experience-tree-data.ts.
 * Returns a sanitized result; never throws.
 */
export function runExperienceTreeDryRun({ psql, read, migrationFiles, data }) {
  const result = { status: "FAIL", stage: "plan", differences: [] };
  const compare = (expected) => {
    const differences = diffSnapshots(
      expected,
      JSON.parse(psql(SNAPSHOT_SQL, DRY_RUN_DATABASE).trim()),
    );
    if (differences.length) {
      result.differences = differences.slice(0, 20);
      result.differenceCount = differences.length;
      throw new Error("Dry run rows differ");
    }
  };
  let created = false;
  try {
    const { previous, target } = splitMigrations(migrationFiles);
    result.stage = "create-database";
    psql(
      `drop database if exists ${DRY_RUN_DATABASE} with (force);\ncreate database ${DRY_RUN_DATABASE};\n`,
      "postgres",
    );
    created = true;
    result.stage = "stubs";
    psql(STUBS_SQL, DRY_RUN_DATABASE);
    result.stage = "previous-migrations";
    for (const file of previous)
      psql(read(`supabase/migrations/${file}`), DRY_RUN_DATABASE);
    result.stage = "fixture";
    psql(data.beforeSql, DRY_RUN_DATABASE);
    result.stage = "fixture-compare";
    compare(data.expectedBefore);
    result.stage = "history";
    psql(HISTORY_SQL, DRY_RUN_DATABASE);
    result.stage = "history-compare";
    compare(data.expectedBefore);
    result.stage = "migration";
    psql(read(`supabase/migrations/${target}`), DRY_RUN_DATABASE);
    result.stage = "migration-compare";
    compare(data.expectedAfter);
    result.stage = "restore";
    psql(RESTORE_CHECK_SQL, DRY_RUN_DATABASE);
    result.stage = "restore-compare";
    compare(data.expectedAfter);
    result.stage = "rollback";
    psql(read(ROLLBACK_FILE), DRY_RUN_DATABASE);
    result.stage = "rollback-compare";
    compare(data.expectedBefore);
    result.stage = "complete";
    result.status = "PASS";
  } catch {
    // result.stage names where it stopped.
  } finally {
    if (created) {
      try {
        psql(
          `drop database if exists ${DRY_RUN_DATABASE} with (force);\n`,
          "postgres",
        );
      } catch {
        result.status = "FAIL";
        result.cleanup = "failed";
      }
    }
  }
  return result;
}
