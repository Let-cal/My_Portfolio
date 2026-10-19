import { describe, expect, it } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { buildMatrix, filterMatrix, parseMatrixFilter, type MatrixFilter } from "@/lib/admin/matrix";

const c = contentSchema.parse(seed);
const all: MatrixFilter = { q: "", only: "all", group: "all", showHidden: true };
const rows = (m: ReturnType<typeof buildMatrix>) => m.groups.flatMap((g) => g.rows);

describe("buildMatrix", () => {
  const m = buildMatrix(c);

  it("lists experiences then projects as columns, each by position", () => {
    expect(m.columns).toHaveLength(9);
    expect(m.columns.slice(0, 6).every((col) => col.kind === "experience")).toBe(true);
    expect(m.columns.slice(6).every((col) => col.kind === "project")).toBe(true);
    const expIds = [...c.experiences].sort((a, b) => a.sortIndex - b.sortIndex).map((e) => e.id);
    expect(m.columns.slice(0, 6).map((col) => col.id)).toEqual(expIds);
  });

  it("groups skills in SKILL_GROUPS order with their links", () => {
    expect(m.groups[0].group).toBe("languages");
    expect(m.groups[0].rows).toHaveLength(8);
    const ts = m.groups[0].rows[0];
    expect(ts.skill.name).toBe("TypeScript");
    expect(ts.linked.has("experience:skg-ai-agent")).toBe(true);
    expect(ts.linked.has("project:siteplus")).toBe(true);
  });
});

describe("filterMatrix", () => {
  const m = buildMatrix(c);

  it("keeps the 12 skills without evidence", () => {
    expect(rows(filterMatrix(m, { ...all, only: "orphan" }, c))).toHaveLength(12);
  });

  it("searches names without case or accents", () => {
    const names = rows(filterMatrix(m, { ...all, q: "REACT" }, c)).map((r) => r.skill.name);
    expect(names).toContain("React");
    expect(names).toContain("React Testing Library");
  });

  it("drops empty groups and limits to one group", () => {
    const only = filterMatrix(m, { ...all, group: "frameworks" }, c);
    expect(only.groups.map((g) => g.group)).toEqual(["frameworks"]);
  });

  it("can hide columns of hidden items", () => {
    const hidden = structuredClone(c);
    hidden.projects[0].published = false;
    const filtered = filterMatrix(buildMatrix(hidden), { ...all, showHidden: false }, hidden);
    expect(filtered.columns.some((col) => col.id === hidden.projects[0].id)).toBe(false);
  });

  it("finds skills whose only evidence is hidden", () => {
    const h = structuredClone(c);
    const skill = h.skills.find((s) => s.experienceIds.length === 1 && s.projectIds.length === 0)!;
    h.experiences.find((e) => e.id === skill.experienceIds[0])!.published = false;
    const names = rows(filterMatrix(buildMatrix(h), { ...all, only: "hidden-evidence" }, h)).map((r) => r.skill.id);
    expect(names).toContain(skill.id);
  });
});

describe("parseMatrixFilter", () => {
  it("reads the dashboard links", () => {
    expect(parseMatrixFilter({ filter: "orphan" }).only).toBe("orphan");
    expect(parseMatrixFilter({ filter: "hidden-evidence" }).only).toBe("hidden-evidence");
  });
  it("falls back to defaults on unknown values", () => {
    expect(parseMatrixFilter({ filter: "x", group: "nope" })).toEqual({ q: "", only: "all", group: "all", showHidden: true });
    expect(parseMatrixFilter({ q: ["a", "b"], group: "ai", hidden: "0" })).toEqual({
      q: "a",
      only: "all",
      group: "ai",
      showHidden: false,
    });
  });
});
