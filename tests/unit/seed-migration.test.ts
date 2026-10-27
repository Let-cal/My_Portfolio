import { describe, expect, it } from "vitest";
import { contentSchema, type Link, type RoleKey } from "@/content/schema";
import seed from "@/content/seed.json";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import vi from "@/messages/vi.json";
// Full seed.json as of commit 215173f, before the migration.
import before from "../fixtures/seed-before-experience-tree.json";

// The seed mirrors the hosted data after supabase/migrations/*_experience_tree_projects.sql.
const c = contentSchema.parse(seed);

/** Old experience id -> new project id. */
const MOVED: Record<string, string> = {
  "skg-ai-agent": "skg-ai-agent",
  "skg-flexybox-p2": "skg-flexybox-p2",
  "skg-coa": "skg-coa",
  "skg-flexybox-p1": "skg-flexybox-p1",
  "skg-intern": "tongue-ai-driver-ms",
};

/** Owner-confirmed stint of each work project. */
const STINT: Record<string, string> = {
  "tongue-ai-driver-ms": "skg-intern",
  "skg-flexybox-p1": "skg-intern",
  "skg-coa": "skg-engineer",
  "skg-flexybox-p2": "skg-engineer",
  "skg-ai-agent": "skg-engineer",
};

const UNIVERSITY = ["siteplus", "zodiacgems", "meet-my-lecturer"];

/** Same rule as pg_temp.role_tags in the migration. */
function roleTags(position: string): RoleKey[] {
  const tags: RoleKey[] = [];
  if (/full-stack|developer|front-end/i.test(position)) tags.push("fullstack");
  if (/tech lead/i.test(position)) tags.push("techlead");
  if (/\bPM\b/.test(position) || /project manager/i.test(position))
    tags.push("pm");
  return tags;
}

const project = (id: string) => c.projects.find((p) => p.id === id);

describe("seed after the experience tree migration", () => {
  it("5 work projects attached to SKG stints with the owner's stint mapping", () => {
    const work = c.projects.filter((p) => p.kind === "work");
    expect(Object.fromEntries(work.map((p) => [p.id, p.experienceId]))).toEqual(
      STINT,
    );
    expect(work.every((p) => p.educationId === null)).toBe(true);
    expect(c.experiences.map((e) => e.id)).toEqual([
      "skg-engineer",
      "skg-intern",
      "fpt-japan",
    ]);
  });

  it("the two SKG stints carry their titles and periods, with no summary", () => {
    const stint = (id: string) => c.experiences.find((e) => e.id === id)!;
    const titles = (key: "skgIntern" | "skgEngineer") => ({
      en: en.experience[key],
      ja: ja.experience[key],
      vi: vi.experience[key],
    });
    expect(stint("skg-intern")).toMatchObject({
      company: "SKG Software (Splus)",
      parentCompany: "SKG Software (Splus)",
      position: titles("skgIntern"),
      start: "2025-08",
      end: "2025-10",
      employmentType: "internship",
      summary: { en: "" },
      caseStudy: null,
      tech: [],
    });
    expect(stint("skg-engineer")).toMatchObject({
      company: "SKG Software (Splus)",
      parentCompany: "SKG Software (Splus)",
      position: titles("skgEngineer"),
      start: "2025-10",
      end: "2026-09",
      employmentType: "full-time",
      summary: { en: "" },
      caseStudy: null,
      tech: [],
      published: true,
    });
  });

  it("3 starred university projects in order siteplus, zodiacgems, meet-my-lecturer", () => {
    const starred = c.projects
      .filter((p) => p.featured)
      .sort((a, b) => a.featuredOrder! - b.featuredOrder!);
    expect(starred.map((p) => [p.id, p.featuredOrder])).toEqual([
      ["siteplus", 1],
      ["zodiacgems", 2],
      ["meet-my-lecturer", 3],
    ]);
    for (const id of UNIVERSITY)
      expect(project(id)).toMatchObject({
        kind: "university",
        educationId: "fpt-university",
        experienceId: null,
      });
    expect(c.projects.filter((p) => p.kind === "personal")).toEqual([]);
  });

  it("university projects keep their text", () => {
    for (const old of before.projects) {
      const { id, ...text } = old;
      expect(project(id), id).toMatchObject(text);
    }
  });

  it("role tags follow the position text", () => {
    for (const p of c.projects)
      expect(p.roles, p.id).toEqual(roleTags(p.role.en));
    expect(project("skg-flexybox-p2")!.roles).toEqual(["techlead", "pm"]);
    expect(project("skg-coa")!.roles).toEqual(["fullstack", "techlead"]);
  });

  it("no why card points at a missing anchor", () => {
    const starred = new Set(
      c.projects.filter((p) => p.featured).map((p) => p.id),
    );
    const inTree = new Set(
      c.projects.filter((p) => p.kind !== "personal").map((p) => p.id),
    );
    for (const card of c.whyCards) {
      if (!card.evidenceLink) continue;
      const [, prefix, id] = /^#(exp|proj|tree)-(.+)$/.exec(card.evidenceLink)!;
      const target =
        prefix === "proj" ? starred : prefix === "tree" ? inTree : new Set();
      expect(target.has(id), card.evidenceLink).toBe(true);
    }
    // Links that pointed at a moved experience now point at its tree card.
    for (const old of before.whyCards) {
      const now = c.whyCards.find((w) => w.id === old.id)!.evidenceLink;
      const moved = /^#exp-(.+)$/.exec(old.evidenceLink ?? "")?.[1];
      expect(now).toBe(
        moved && MOVED[moved] ? `#tree-${MOVED[moved]}` : old.evidenceLink,
      );
    }
  });

  it("every moved project keeps its summary, case study and skill links", () => {
    for (const old of before.experiences.filter((e) => MOVED[e.id])) {
      const p = project(MOVED[old.id]);
      const links = old.links as Link[];
      expect(p, old.id).toMatchObject({
        title: old.company,
        role: old.position,
        start: old.start,
        end: old.end,
        summary: old.summary,
        caseStudy: old.caseStudy,
        tech: old.tech,
        teamSize: old.teamSize,
        published: old.published,
        sortIndex: old.sortIndex,
        demoUrl: links.find((l) => l.label === "Demo")?.url ?? null,
        repoUrls: links.filter((l) => l.label === "Code").map((l) => l.url),
        links: links.filter((l) => l.label !== "Code" && l.label !== "Demo"),
        kind: "work",
      });
    }
    for (const oldSkill of before.skills) {
      const skill = c.skills.find((s) => s.id === oldSkill.id)!;
      const expectedProjects = [
        ...oldSkill.projectIds,
        ...oldSkill.experienceIds.filter((e) => MOVED[e]).map((e) => MOVED[e]),
      ];
      expect([...skill.projectIds].sort(), skill.id).toEqual(
        [...expectedProjects].sort(),
      );
      expect(skill.experienceIds, skill.id).toEqual(
        oldSkill.experienceIds.filter((e) => !MOVED[e]),
      );
    }
  });

  it("every role orders the stints, newest first", () => {
    for (const r of c.roles)
      expect(r.experienceOrder, r.key).toEqual([
        "skg-engineer",
        "skg-intern",
        "fpt-japan",
      ]);
    expect(before.roles.length).toBe(c.roles.length);
  });
});
