// The Skills × Evidence matrix model: rows are skills grouped by skill group, columns are
// experiences then projects. Pure functions, shared by the page and its tests.
import { SKILL_GROUPS, type Skill, type SkillGroup } from "@/content/schema";
import { evidenceOf, type AdminContent } from "./health";

export type MatrixColumn = { kind: "experience" | "project"; id: string; label: string; hidden: boolean };
export type MatrixRow = { skill: Skill; group: SkillGroup; linked: Set<string> };
export type Matrix = { columns: MatrixColumn[]; groups: { group: SkillGroup; rows: MatrixRow[] }[] };
export type MatrixFilter = {
  q: string;
  only: "all" | "orphan" | "hidden-evidence";
  group: SkillGroup | "all";
  showHidden: boolean;
};

/** Column key used in `MatrixRow.linked`: "experience:<id>" or "project:<id>". */
export const columnKey = (col: Pick<MatrixColumn, "kind" | "id">) => `${col.kind}:${col.id}`;

const bySort = <T extends { sortIndex: number }>(a: T, b: T) => a.sortIndex - b.sortIndex;

export function buildMatrix(c: AdminContent): Matrix {
  const columns: MatrixColumn[] = [
    ...[...c.experiences].sort(bySort).map((e) => ({ kind: "experience" as const, id: e.id, label: e.company, hidden: !e.published })),
    ...[...c.projects].sort(bySort).map((p) => ({ kind: "project" as const, id: p.id, label: p.title, hidden: !p.published })),
  ];
  const groups = SKILL_GROUPS.map((group) => ({
    group,
    rows: c.skills
      .filter((s) => s.group === group)
      .sort(bySort)
      .map((skill) => ({
        skill,
        group,
        linked: new Set([
          ...skill.experienceIds.map((id) => `experience:${id}`),
          ...skill.projectIds.map((id) => `project:${id}`),
        ]),
      })),
  })).filter((g) => g.rows.length > 0);
  return { columns, groups };
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();

/** `pinned` skills stay visible whatever the filter (e.g. rows edited since the filter was set). */
export function filterMatrix(m: Matrix, f: MatrixFilter, c: AdminContent, pinned?: ReadonlySet<string>): Matrix {
  const q = fold(f.q.trim());
  const keep = (row: MatrixRow) => {
    if (pinned?.has(row.skill.id)) return true;
    if (q && !fold(row.skill.name).includes(q)) return false;
    if (f.only === "all") return true;
    const ev = evidenceOf(row.skill, c);
    return f.only === "orphan" ? ev.visible + ev.hidden === 0 : ev.visible === 0 && ev.hidden > 0;
  };
  return {
    columns: f.showHidden ? m.columns : m.columns.filter((col) => !col.hidden),
    groups: m.groups
      .filter((g) => f.group === "all" || g.group === f.group)
      .map((g) => ({ ...g, rows: g.rows.filter(keep) }))
      .filter((g) => g.rows.length > 0),
  };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseMatrixFilter(sp: Record<string, string | string[] | undefined>): MatrixFilter {
  const only = first(sp.filter);
  const group = first(sp.group);
  return {
    q: first(sp.q) ?? "",
    only: only === "orphan" || only === "hidden-evidence" ? only : "all",
    group: group && (SKILL_GROUPS as readonly string[]).includes(group) ? (group as SkillGroup) : "all",
    showHidden: first(sp.hidden) !== "0",
  };
}

/** The query string for a filter, omitting defaults. */
export function matrixQuery(f: MatrixFilter): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.only !== "all") p.set("filter", f.only);
  if (f.group !== "all") p.set("group", f.group);
  if (!f.showHidden) p.set("hidden", "0");
  const s = p.toString();
  return s ? `?${s}` : "";
}
