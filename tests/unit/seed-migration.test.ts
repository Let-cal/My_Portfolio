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

  it("university projects keep their text, except what the live database corrected on 2026-10-27", () => {
    // These columns were corrected on the live database after the pre-migration seed was frozen; seed.json mirrors it.
    const corrected: Record<string, string[]> = {
      "meet-my-lecturer": ["role", "summary", "tech", "repoUrls"],
      zodiacgems: ["role", "demoUrl"],
      siteplus: ["demoUrl"],
    };
    for (const old of before.projects) {
      const { id, ...text } = old;
      const kept = Object.fromEntries(
        Object.entries(text).filter(([k]) => !corrected[id]?.includes(k)),
      );
      expect(project(id), id).toMatchObject(kept);
    }
  });

  it("seed mirrors the corrected live project texts", () => {
    expect(project("meet-my-lecturer")).toMatchObject({
      role: {
        en: "Team Lead, full-stack",
        ja: "チームリーダー・フルスタック開発",
        vi: "Trưởng nhóm, full-stack",
      },
      summary: {
        en: "University project: a web app where students book meeting slots with lecturers. Lecturers attach a Google Meet link, and bookings send email notices.",
        ja: "大学のプロジェクトです。学生が講師との面談枠を予約できるWebアプリで、講師がGoogle Meetのリンクを登録し、予約はメールで通知されます。",
        vi: "Dự án đại học: web app cho sinh viên đặt lịch gặp giảng viên. Giảng viên gắn link Google Meet, việc đặt lịch được thông báo qua email.",
      },
      tech: [
        "Java Servlet",
        "JSP",
        "SQL Server",
        "Google Sign-In",
        "JavaMail",
        "Figma",
      ],
      repoUrls: ["https://github.com/SWP309/meet-my-lecturers"],
    });
    expect(project("zodiacgems")).toMatchObject({
      role: {
        en: "Team Lead, front-end",
        ja: "チームリーダー・フロントエンド開発",
        vi: "Trưởng nhóm, front-end",
      },
      demoUrl: "https://swd-392.vercel.app",
    });
    expect(project("siteplus")!.demoUrl).toBe(
      "https://site-plus-fe.vercel.app",
    );
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
    const moved = before.experiences
      .filter((e) => MOVED[e.id])
      .sort((a, b) => a.sortIndex - b.sortIndex || a.id.localeCompare(b.id));
    expect(moved).toHaveLength(5);
    // Numbered after the existing projects, in their old order (no sort_index ties).
    const after = Math.max(...before.projects.map((p) => p.sortIndex)) + 1;
    for (const old of moved) {
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
        sortIndex: after + moved.indexOf(old),
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

  it("projects have distinct sort indexes", () => {
    const indexes = c.projects.map((p) => p.sortIndex);
    expect(new Set(indexes).size).toBe(indexes.length);
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
