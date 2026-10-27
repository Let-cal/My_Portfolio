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
