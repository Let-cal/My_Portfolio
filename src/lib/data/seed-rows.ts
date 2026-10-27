import type { Content } from "@/content/schema";
import { creationOrder, TABLES, type TableName } from "./columns";
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
} from "./mappers";

export type SeedRows = { [T in TableName]: Record<string, unknown>[] };

/** Every table's rows for a full content snapshot, in foreign-key order. */
export function buildSeedRows(c: Content): SeedRows {
  const rows: SeedRows = {
    profile: [{ id: "me", ...profileToRow(c.profile) }],
    roles: c.roles.map(roleToRow),
    experiences: c.experiences.map(experienceToRow),
    skills: c.skills.map(skillToRow),
    skill_links: c.skills.flatMap(skillToLinkRows),
    certificates: c.certificates.map(certificateToRow),
    activities: c.activities.map(activityToRow),
    education: c.education.map(educationToRow),
    projects: c.projects.map(projectToRow),
    why_cards: c.whyCards.map(whyCardToRow),
  };
  // Keys in creation order, so a table is written after the tables it references.
  return Object.fromEntries(
    creationOrder().map((t) => [t, rows[t]]),
  ) as SeedRows;
}

/** Upsert key per table; skill_links are replaced as a whole instead. */
export const CONFLICT_KEY: Record<Exclude<TableName, "skill_links">, string> = {
  profile: "id",
  roles: "key",
  experiences: "id",
  projects: "id",
  skills: "id",
  certificates: "id",
  activities: "id",
  education: "id",
  why_cards: "id",
};

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

function literal(value: unknown, type: string): string {
  if (value === null || value === undefined) return "null";
  switch (type) {
    case "jsonb":
      return `${quote(JSON.stringify(value))}::jsonb`;
    case "text[]":
      return `array[${(value as string[]).map(quote).join(", ")}]::text[]`;
    case "boolean":
      return value ? "true" : "false";
    case "integer":
      return String(Number(value));
    default:
      return quote(String(value));
  }
}

/** The same snapshot as one SQL script, for seeding through the SQL editor or an MCP client. */
export function renderSeedSql(rows: SeedRows): string {
  const out = ["begin;"];
  for (const [table, list] of Object.entries(rows) as [
    TableName,
    Record<string, unknown>[],
  ][]) {
    const columns = TABLES[table].columns;
    if (table === "skill_links") out.push("delete from public.skill_links;");
    if (!list.length) continue;
    const names = columns.map((c) => c.name);
    const values = list.map(
      (row) =>
        `(${columns.map((c) => literal(row[c.name], c.type)).join(", ")})`,
    );
    let sql = `insert into public.${table} (${names.join(", ")}) values\n  ${values.join(",\n  ")}`;
    if (table !== "skill_links") {
      const key = CONFLICT_KEY[table];
      const updates = names
        .filter((n) => n !== key)
        .map((n) => `${n} = excluded.${n}`);
      sql += `\non conflict (${key}) do update set ${updates.join(", ")}`;
    }
    out.push(sql + ";");
  }
  out.push("commit;");
  return out.join("\n") + "\n";
}
