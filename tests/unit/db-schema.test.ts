import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import vi from "@/messages/vi.json";
import { TABLES, type Table, type TableName } from "@/lib/data/columns";
import {
  renderSchemaSql,
  VERSIONED_TABLES,
  REALTIME_SQL,
  PROJECT_LINK_INDEXES_SQL,
  RESTORE_BARRIERS_SQL,
  REVIEWER_SQL,
  VERSIONS_SECURITY_SQL,
  VERSIONS_SQL,
} from "@/lib/data/schema-sql";
import {
  activityToRow,
  certificateToRow,
  educationToRow,
  experienceToRow,
  profileToRow,
  projectToRow,
  roleToRow,
  skillToLinkRows,
  skillToRow,
  whyCardToRow,
} from "@/lib/data/mappers";

const c = contentSchema.parse(seed);

// The row each table receives from its mapper; profile gets its fixed id from the seed script.
const sampleRows: Record<TableName, object> = {
  profile: { id: "me", ...profileToRow(c.profile) },
  roles: roleToRow(c.roles[0]),
  experiences: experienceToRow(c.experiences[0]),
  projects: projectToRow(c.projects[0]),
  skills: skillToRow(c.skills[0]),
  skill_links: skillToLinkRows(
    c.skills.find((s) => s.experienceIds.length > 0)!,
  )[0],
  certificates: certificateToRow(c.certificates[0]),
  activities: activityToRow(c.activities[0]),
  education: educationToRow(c.education[0]),
  why_cards: whyCardToRow(c.whyCards[0]),
};

describe("database columns", () => {
  it.each(Object.keys(TABLES) as TableName[])(
    "%s has exactly the mapper's columns",
    (table) => {
      const declared = TABLES[table].columns.map((col) => col.name).sort();
      expect(declared).toEqual(Object.keys(sampleRows[table]).sort());
    },
  );

  it("only tables with a published column hide rows from visitors", () => {
    for (const [name, table] of Object.entries(TABLES) as [string, Table][]) {
      const hasColumn = table.columns.some((col) => col.name === "published");
      expect(hasColumn, name).toBe(Boolean(table.hasPublished));
    }
  });
});

describe("schema SQL", () => {
  it("the committed schema is generated from columns.ts", () => {
    const committed = readFileSync("supabase/schema.sql", "utf8").replace(
      /\r\n/g,
      "\n",
    );
    expect(committed).toBe(renderSchemaSql());
  });

  it("turns on row level security for every public table", () => {
    const sql = renderSchemaSql();
    for (const table of Object.keys(TABLES)) {
      expect(sql).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
  });

  it("lets visitors read published rows only and lets only admins write", () => {
    const sql = renderSchemaSql();
    expect(sql).toMatch(
      /create policy "experiences_read" on public\.experiences for select to anon, authenticated using \(published or private\.is_admin\(\)\);/,
    );
    expect(sql).toMatch(
      /create policy "skills_read" on public\.skills for select to anon, authenticated using \(true\);/,
    );
    expect(sql).toMatch(
      /create policy "skills_write" on public\.skills for all to authenticated using \(private\.is_admin\(\)\) with check \(private\.is_admin\(\)\);/,
    );
    expect(sql).toContain("create table private.app_admins");
    expect(sql).toContain(
      "revoke all on private.app_admins from public, anon, authenticated;",
    );
  });

  it("does not count a reorder as an edit", () => {
    const sql = renderSchemaSql();
    const fn = sql.slice(
      sql.indexOf("function public.set_updated_at"),
      sql.indexOf("$$;"),
    );
    expect(fn).toContain("- 'sort_index'");
    expect(fn).toContain("new.updated_at = old.updated_at");
  });

  it("keeps a single profile row", () => {
    expect(renderSchemaSql()).toContain("check (id = 'me')");
  });
});

describe("content versions", () => {
  it("records versions on all 10 content tables", () => {
    const sql = renderSchemaSql();
    expect(VERSIONED_TABLES).toHaveLength(10);
    for (const name of VERSIONED_TABLES) {
      expect(sql).toContain(
        `create trigger ${name}_version after update or delete on public.${name}`,
      );
    }
  });

  it("ignores reorder-only updates and keeps 50 versions per item", () => {
    expect(VERSIONS_SQL).toContain("- 'sort_index' - 'updated_at'");
    expect(VERSIONS_SQL).toContain("offset 50");
  });

  it("only signed-in admins can list or restore", () => {
    expect(VERSIONS_SQL).toContain(
      "grant execute on function public.admin_list_versions(text, text) to authenticated",
    );
    expect(VERSIONS_SQL).toContain(
      "grant execute on function public.admin_restore_version(bigint) to authenticated",
    );
    expect(VERSIONS_SQL).toContain(
      "revoke execute on function public.admin_restore_version(bigint) from public, anon",
    );
    expect(
      VERSIONS_SQL.match(/private\.is_admin\(\)/g)!.length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("restoring an edit keeps the item's current position", () => {
    // Reorders write no version, so an old sort_index would move the item.
    expect(VERSIONS_SQL).toContain("c.column_name <> 'sort_index'");
  });

  it("the migration is exactly the versions section", () => {
    const migration = readFileSync(
      "supabase/migrations/20261020074656_content_versions.sql",
      "utf8",
    ).replace(/\r\n/g, "\n");
    expect(migration).toContain(VERSIONS_SQL);
  });

  it("history functions run with the caller's rights; only admins read history (lint 0029)", () => {
    expect(VERSIONS_SECURITY_SQL).toContain(
      "alter function public.admin_list_versions(text, text) security invoker;",
    );
    expect(VERSIONS_SECURITY_SQL).toContain(
      "alter function public.admin_restore_version(bigint) security invoker;",
    );
    expect(VERSIONS_SECURITY_SQL).toMatch(
      /create policy "content_versions_admin_read" on private\.content_versions for select to authenticated using \(private\.is_admin\(\)\);/,
    );
    expect(renderSchemaSql()).toContain(VERSIONS_SECURITY_SQL);
    const migration = readFileSync(
      "supabase/migrations/20261020074657_versions_security_invoker.sql",
      "utf8",
    ).replace(/\r\n/g, "\n");
    expect(migration).toContain(VERSIONS_SECURITY_SQL);
  });
});

describe("admin realtime", () => {
  it("every content table sends a tiny change note on a private admin topic", () => {
    for (const name of VERSIONED_TABLES) {
      expect(renderSchemaSql()).toContain(
        `create trigger ${name}_broadcast after insert or update or delete on public.${name}`,
      );
    }
    expect(REALTIME_SQL).toContain("realtime.send(");
    expect(REALTIME_SQL).toContain("'admin:content'");
    // Only the table, operation and key travel, never the row itself.
    expect(REALTIME_SQL).toContain(
      "jsonb_build_object('table', tg_table_name, 'op', lower(tg_op), 'key'",
    );
  });

  it("only the admin can listen, and a failed send never blocks a save", () => {
    expect(REALTIME_SQL).toContain(
      `create policy "admin_content_receive" on realtime.messages for select to authenticated using (realtime.topic() = 'admin:content' and private.is_admin());`,
    );
    expect(REALTIME_SQL).toContain("exception when others then");
    expect(REALTIME_SQL).toContain(
      "revoke execute on function private.broadcast_content_change() from public, anon, authenticated;",
    );
  });

  it("the migration is exactly the realtime section", () => {
    const migration = readFileSync(
      "supabase/migrations/20261020160958_admin_realtime.sql",
      "utf8",
    ).replace(/\r\n/g, "\n");
    expect(migration).toContain(REALTIME_SQL);
  });
});

describe("experience tree migration", () => {
  const read = (path: string) =>
    readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const file = readdirSync("supabase/migrations").find((f) =>
    /^\d{14}_experience_tree_projects\.sql$/.test(f),
  );
  const sql = file ? read(`supabase/migrations/${file}`) : "";
  const ROLLBACK = "docs/experience-tree-rollback.sql";
  const rollback = existsSync(ROLLBACK) ? read(ROLLBACK) : "";
  const NEW_COLUMNS = [
    "experience_id",
    "education_id",
    "kind",
    "featured",
    "featured_order",
    "roles",
    "team_size",
    "links",
  ];
  const MOVED = `('skg-ai-agent', 'skg-flexybox-p2', 'skg-coa', 'skg-flexybox-p1')`;

  it("migration adds columns and check, moves five rows, rewrites why cards", () => {
    expect(file, "CLI-style migration file").toBeTruthy();
    // Columns and the kind/link check exactly as columns.ts declares them.
    for (const col of TABLES.projects.columns.filter((c) =>
      NEW_COLUMNS.includes(c.name),
    )) {
      const def = [
        `${col.name} ${col.type}`,
        col.nullable ? "" : " not null",
        col.default ? ` default ${col.default}` : "",
        col.constraint ? ` ${col.constraint}` : "",
      ].join("");
      expect(sql).toContain(`add column ${def}`);
    }
    expect(sql).toContain(`add ${TABLES.projects.tableConstraints[0]}`);
    // The new stint exists before projects point at it; the internship content is copied
    // to its project before the row turns into the stint.
    const engineer = sql.indexOf("insert into public.experiences");
    const copy = sql.indexOf("insert into public.projects");
    const convert = sql.indexOf("update public.experiences");
    const relink = sql.indexOf("update public.skill_links");
    const remove = sql.indexOf(
      `delete from public.experiences where id in ${MOVED};`,
    );
    expect(engineer).toBeGreaterThan(-1);
    expect(copy).toBeGreaterThan(engineer);
    expect(convert).toBeGreaterThan(copy);
    // Links move before the delete, which would otherwise cascade them away.
    expect(relink).toBeGreaterThan(copy);
    expect(remove).toBeGreaterThan(relink);
    expect(sql).toContain(
      `where e.id in ('skg-ai-agent', 'skg-flexybox-p2', 'skg-coa', 'skg-flexybox-p1', 'skg-intern')`,
    );
    expect(sql).toContain("'tongue-ai-driver-ms'");
    expect(sql).toContain("update public.why_cards");
    expect(sql).toContain("'#tree-'");
    expect(sql).toContain("update public.roles");
    // The converted internship row is never deleted.
    expect(sql).not.toMatch(/delete from public\.experiences[^;]*skg-intern/);
  });

  it("stint titles come from the experience messages", () => {
    for (const key of ["skgIntern", "skgEngineer"] as const) {
      const titles = {
        en: en.experience[key],
        ja: ja.experience[key],
        vi: vi.experience[key],
      };
      expect(sql).toContain(`'${JSON.stringify(titles)}'::jsonb`);
    }
  });

  it("rollback restores the rows and drops what the migration added", () => {
    expect(rollback).toMatch(/^begin;$/m);
    expect(rollback).toMatch(/^commit;$/m);
    for (const name of NEW_COLUMNS)
      expect(rollback).toContain(`drop column ${name}`);
    expect(rollback).toContain("drop constraint projects_kind_matches_link");
    expect(rollback).toContain("insert into public.experiences");
    expect(rollback).toContain("update public.skill_links");
    expect(rollback).toContain("update public.why_cards");
    expect(rollback).toContain("update public.roles");
    expect(rollback).toContain(
      "delete from public.experiences where id = 'skg-engineer';",
    );
    expect(rollback).toContain("drop table private.experience_tree_backup;");
    // Experiences come back before links point at them again, and projects go before columns.
    expect(rollback.indexOf("insert into public.experiences")).toBeLessThan(
      rollback.indexOf("update public.skill_links"),
    );
    expect(rollback.indexOf("delete from public.projects")).toBeLessThan(
      rollback.indexOf("drop column"),
    );
  });

  it("has a rollout runbook that the rollback header and the plan link to (app rollback first)", () => {
    const RUNBOOK = "docs/experience-tree-rollout.md";
    expect(existsSync(RUNBOOK)).toBe(true);
    const runbook = read(RUNBOOK);
    const header = rollback.slice(0, rollback.indexOf("begin;"));
    expect(header).toContain("docs/experience-tree-rollout.md");
    expect(header).not.toMatch(/afterwards[\s\S]*revert the app/i);
    expect(
      read("docs/superpowers/plans/2026-10-27-experience-tree-and-projects.md"),
    ).toContain("docs/experience-tree-rollout.md");
    // Rollback order: production app first, then the SQL, then the history row.
    const instant = runbook.indexOf("Instant Rollback");
    const sqlStep = runbook.indexOf("experience-tree-rollback.sql", instant);
    expect(instant).toBeGreaterThan(-1);
    expect(sqlStep).toBeGreaterThan(instant);
    for (const table of [
      "private.experience_tree_backup",
      "private.restore_barriers",
    ])
      expect(runbook).toContain(table);
  });
});

describe("version restore after the experience tree migration", () => {
  const file = readdirSync("supabase/migrations").find((f) =>
    /^\d{14}_experience_tree_projects\.sql$/.test(f),
  );
  const read = (path: string) =>
    readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const sql = file ? read(`supabase/migrations/${file}`) : "";
  const rollback = read("docs/experience-tree-rollback.sql");
  const fn = RESTORE_BARRIERS_SQL.slice(
    RESTORE_BARRIERS_SQL.indexOf(
      "create or replace function public.admin_restore_version",
    ),
  );

  it("the migration is exactly the restore section, and the schema includes it", () => {
    expect(sql).toContain(RESTORE_BARRIERS_SQL);
    expect(renderSchemaSql()).toContain(RESTORE_BARRIERS_SQL);
  });

  it("stays admin-only with the caller's rights", () => {
    expect(fn).toMatch(
      /language plpgsql security invoker set search_path = ''/,
    );
    const guard = fn.indexOf("if not private.is_admin() then");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(fn.indexOf("private.content_versions where"));
    expect(fn).not.toContain("is_reviewer");
    expect(RESTORE_BARRIERS_SQL).toContain(
      "revoke execute on function public.admin_restore_version(bigint) from public, anon;",
    );
    expect(RESTORE_BARRIERS_SQL).toContain(
      'create policy "restore_barriers_admin_read" on private.restore_barriers for select to authenticated using (private.is_admin());',
    );
    expect(RESTORE_BARRIERS_SQL).toContain(
      "revoke all on private.restore_barriers from public, anon, authenticated;",
    );
  });

  it("fills keys an old row lacks from the current row, else the column defaults", () => {
    expect(fn).toContain(
      "execute format('select to_jsonb(t) from public.%1$I t where t.%2$I = $1', v.table_name, pk)",
    );
    expect(fn).toContain("pg_catalog.pg_get_expr(d.adbin, d.adrelid)");
    expect(fn).toContain("fill := fill || v.old_row;");
    expect(fn.match(/using fill;/g)).toHaveLength(2);
    expect(fn).not.toContain("using v.old_row");
    // Restoring an edit still keeps the current position.
    expect(fn).toContain("c.column_name <> 'sort_index'");
  });

  it("refuses versions behind a barrier before writing anything", () => {
    const barrier = fn.indexOf("from private.restore_barriers b");
    expect(barrier).toBeGreaterThan(-1);
    expect(barrier).toBeLessThan(fn.indexOf("execute format("));
    expect(fn).toContain("v.id <= b.last_version_id");
    // Barriers cover the five moved rows, up to the versions the migration itself wrote.
    const insert = sql.indexOf("insert into private.restore_barriers");
    expect(insert).toBeGreaterThan(
      sql.indexOf("delete from public.experiences where id in"),
    );
    for (const id of [
      "skg-ai-agent",
      "skg-flexybox-p2",
      "skg-coa",
      "skg-flexybox-p1",
      "skg-intern",
    ])
      expect(sql.slice(insert)).toContain(`('${id}', '`);
    expect(sql.slice(insert)).toContain(
      "max(id) as last_id from private.content_versions",
    );
  });

  it("numbers the moved projects after the existing ones; the rollback puts the old numbers back", () => {
    expect(sql).toContain(
      "(select coalesce(max(sort_index), -1) from public.projects) + row_number() over (order by e.sort_index, e.id)",
    );
    expect(rollback).toContain(
      "prev.sort_index, prev.created_at, prev.updated_at",
    );
    expect(rollback).toContain("sort_index = prev.sort_index");
  });

  it("the rollback puts the previous restore function back and drops the barriers", () => {
    const start = VERSIONS_SQL.indexOf(
      "create or replace function public.admin_restore_version",
    );
    const original = VERSIONS_SQL.slice(
      start,
      VERSIONS_SQL.indexOf("\n$$;", start) + 4,
    ).replace("security definer", "security invoker");
    expect(rollback).toContain(original);
    expect(rollback.indexOf(original)).toBeLessThan(
      rollback.indexOf("drop table private.restore_barriers;"),
    );
  });
});

describe("read-only reviewer", () => {
  it("can read every content table, hidden rows included", () => {
    for (const name of VERSIONED_TABLES) {
      expect(REVIEWER_SQL).toContain(
        `create policy "${name}_reviewer_read" on public.${name} for select to authenticated using (private.is_reviewer());`,
      );
    }
    expect(renderSchemaSql()).toContain(REVIEWER_SQL);
  });

  it("gets no write path anywhere", () => {
    const policies = REVIEWER_SQL.match(/create policy[^;]*;/g) ?? [];
    expect(policies.length).toBeGreaterThan(10);
    for (const policy of policies)
      expect(policy).toMatch(/ for select to authenticated /);
    expect(REVIEWER_SQL).not.toMatch(/grant (insert|update|delete|all)/i);
    // Restoring a version stays admin-only: its function is not redefined here.
    expect(REVIEWER_SQL).not.toContain("admin_restore_version");
  });

  it("is identified by a private UID allowlist, not by editable user data", () => {
    expect(REVIEWER_SQL).toContain(
      "user_id uuid primary key references auth.users(id) on delete cascade",
    );
    expect(REVIEWER_SQL).toContain("where r.user_id = auth.uid()");
    expect(REVIEWER_SQL).not.toMatch(
      /user_metadata|app_metadata|auth\.jwt\(\)/,
    );
    expect(REVIEWER_SQL).toContain(
      "revoke all on private.app_reviewers from public, anon, authenticated;",
    );
  });

  it("exposes only an invoker-rights role lookup in the public API (lint 0029)", () => {
    const fn = REVIEWER_SQL.slice(
      REVIEWER_SQL.indexOf(
        "create or replace function public.admin_access_kind",
      ),
    );
    expect(fn).toMatch(/security invoker/);
    expect(REVIEWER_SQL).toContain(
      "revoke execute on function public.admin_access_kind() from public, anon;",
    );
    expect(REVIEWER_SQL).toContain(
      "revoke execute on function private.is_reviewer() from public, anon;",
    );
  });

  it("can list version history and media, and receive live change notes", () => {
    expect(REVIEWER_SQL).toContain(
      'create policy "content_versions_reviewer_read" on private.content_versions for select to authenticated using (private.is_reviewer());',
    );
    expect(REVIEWER_SQL).toMatch(
      /if not \(private\.is_admin\(\) or private\.is_reviewer\(\)\) then/,
    );
    expect(REVIEWER_SQL).toContain(
      `create policy "reviewer_media_select" on storage.objects for select to authenticated using (bucket_id in ('media', 'files') and private.is_reviewer());`,
    );
    expect(REVIEWER_SQL).toContain(
      `create policy "reviewer_content_receive" on realtime.messages for select to authenticated using (realtime.topic() = 'admin:content' and private.is_reviewer());`,
    );
  });

  it("the migration is exactly the reviewer section", () => {
    const file = readdirSync("supabase/migrations").find((f) =>
      /^\d{14}_reviewer_read_only\.sql$/.test(f),
    );
    expect(file, "CLI-generated migration file").toBeTruthy();
    const migration = readFileSync(
      `supabase/migrations/${file}`,
      "utf8",
    ).replace(/\r\n/g, "\n");
    expect(migration).toContain(REVIEWER_SQL);
  });
});

describe("post-rollout cleanup migration", () => {
  const file = readdirSync("supabase/migrations").find((f) =>
    /^\d{14}_post_rollout_cleanup\.sql$/.test(f),
  );
  const sql = file
    ? readFileSync(`supabase/migrations/${file}`, "utf8").replace(/\r\n/g, "\n")
    : "";

  it("indexes the two project links in the migration and the generated schema", () => {
    expect(file).toBeDefined();
    for (const column of ["experience_id", "education_id"]) {
      const line = `create index projects_${column} on public.projects (${column});`;
      expect(PROJECT_LINK_INDEXES_SQL).toContain(line);
      expect(sql).toContain(line);
    }
    expect(renderSchemaSql()).toContain(PROJECT_LINK_INDEXES_SQL);
  });

  it("drops the rollout backup, which ends the experience tree rollback", () => {
    expect(sql).toContain("drop table private.experience_tree_backup;");
    expect(renderSchemaSql()).not.toContain("experience_tree_backup");
    const runbook = readFileSync("docs/experience-tree-rollout.md", "utf8");
    expect(runbook).toContain(file);
  });
});
