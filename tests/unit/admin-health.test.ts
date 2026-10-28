import { describe, expect, it } from "vitest";
import { contentSchema, type Content } from "@/content/schema";
import seed from "@/content/seed.json";
import {
  checkContentHealth,
  evidenceOf,
  translationStats,
} from "@/lib/admin/health";

const base = contentSchema.parse(seed);
const clone = (): Content => structuredClone(base);
const ofKind = (c: Content, kind: string) =>
  checkContentHealth(c).filter((i) => i.kind === kind);

describe("checkContentHealth", () => {
  it("seed reports the 12 orphan skills as one warning", () => {
    expect(ofKind(base, "orphan-skill")).toEqual([
      expect.objectContaining({
        severity: "warning",
        count: 12,
        href: "/admin/skills?filter=orphan",
      }),
    ]);
  });

  it("a skill whose only evidence is hidden is link-to-hidden, not orphan", () => {
    const c = clone();
    const skill = c.skills.find(
      (s) => s.experienceIds.length === 0 && s.projectIds.length === 1,
    )!;
    c.projects.find((p) => p.id === skill.projectIds[0])!.published = false;
    const hidden = ofKind(c, "link-to-hidden");
    expect(hidden).toEqual([
      expect.objectContaining({ href: "/admin/skills?filter=hidden-evidence" }),
    ]);
    expect(hidden[0].count).toBeGreaterThanOrEqual(1);
    expect(ofKind(c, "orphan-skill")[0].count).toBe(12);
  });

  it("missing translations are grouped per item", () => {
    const c = clone();
    c.projects[0].summary.ja = "";
    const issues = ofKind(c, "missing-translation");
    const own = issues.filter(
      (i) => i.href === `/admin/projects/${c.projects[0].id}`,
    );
    expect(own).toHaveLength(1);
    expect(own[0].message).toContain(c.projects[0].title);
    expect(
      ofKind(base, "missing-translation").some((i) => i.href === own[0].href),
    ).toBe(false);
  });

  it("a broken or hidden evidence link is an error", () => {
    const c = clone();
    c.whyCards[0].evidenceLink = "#exp-nope";
    expect(ofKind(c, "broken-evidence")).toEqual([
      expect.objectContaining({
        severity: "error",
        href: `/admin/why_cards/${c.whyCards[0].id}`,
      }),
    ]);
    const d = clone();
    const target = d.whyCards.find((w) =>
      w.evidenceLink?.startsWith("#tree-"),
    )!;
    d.projects.find((p) => `#tree-${p.id}` === target.evidenceLink)!.published =
      false;
    expect(ofKind(d, "broken-evidence")).toEqual([
      expect.objectContaining({ href: `/admin/why_cards/${target.id}` }),
    ]);
  });

  describe("evidence anchors follow the experience tree", () => {
    const withLink = (link: string | null) => {
      const c = clone();
      c.whyCards[0].evidenceLink = link;
      return ofKind(c, "broken-evidence");
    };

    // Errors for the first why card only: hiding a stint also breaks the seed's other cards that point into it.
    const firstCardErrors = (c: Content) =>
      ofKind(c, "broken-evidence").filter(
        (i) => i.href === `/admin/why_cards/${c.whyCards[0].id}`,
      );

    it("health: why card #tree-skg-coa is valid", () => {
      expect(withLink("#tree-skg-coa")).toEqual([]);
    });

    it("the seed's why cards are all valid", () => {
      expect(ofKind(base, "broken-evidence")).toEqual([]);
    });

    it("a tree parent is valid by its group slug, not by a stint id", () => {
      expect(withLink("#exp-skg-software")).toEqual([]);
      expect(withLink("#exp-fpt-university")).toEqual([]);
      expect(withLink("#exp-skg-engineer")).toHaveLength(1);
      expect(withLink("#exp-skg-intern")).toHaveLength(1);
    });

    it("a tree parent whose stints are all hidden is broken", () => {
      const c = clone();
      c.whyCards[0].evidenceLink = "#exp-skg-software";
      for (const e of c.experiences)
        if (e.company.startsWith("SKG")) e.published = false;
      expect(firstCardErrors(c)).toHaveLength(1);
    });

    it("a tree child is broken when its project or its stint is hidden", () => {
      const a = clone();
      a.whyCards[0].evidenceLink = "#tree-skg-coa";
      a.projects.find((p) => p.id === "skg-coa")!.published = false;
      expect(firstCardErrors(a)).toHaveLength(1);
      const b = clone();
      b.whyCards[0].evidenceLink = "#tree-skg-coa";
      b.experiences.find((e) => e.id === "skg-engineer")!.published = false;
      expect(firstCardErrors(b)).toHaveLength(1);
    });

    it("#proj- is valid only for a project with a home card", () => {
      expect(withLink("#proj-siteplus")).toEqual([]);
      expect(withLink("#proj-skg-coa")).toHaveLength(1);
      const c = clone();
      for (const id of ["zodiacgems", "meet-my-lecturer"])
        c.projects.find((p) => p.id === id)!.featured = false;
      c.whyCards[0].evidenceLink = "#proj-skg-ai-agent";
      expect(ofKind(c, "broken-evidence")).toEqual([]);
    });
  });

  it("the seed has no health errors", () => {
    expect(
      checkContentHealth(base).filter((i) => i.severity === "error"),
    ).toEqual([]);
  });

  it("health: 4 featured → error", () => {
    const c = clone();
    expect(ofKind(c, "too-many-featured")).toEqual([]);
    c.projects.find((p) => p.id === "skg-coa")!.featured = true;
    c.projects.find((p) => p.id === "skg-coa")!.featuredOrder = 4;
    expect(ofKind(c, "too-many-featured")).toEqual([
      expect.objectContaining({
        severity: "error",
        count: 4,
        href: "/admin/projects",
      }),
    ]);
  });

  it("a project whose kind and link disagree is a warning", () => {
    expect(ofKind(base, "kind-link-mismatch")).toEqual([]);
    const c = clone();
    c.projects.find((p) => p.id === "skg-coa")!.educationId = "fpt-university";
    c.projects.find((p) => p.id === "siteplus")!.kind = "work";
    c.projects.find((p) => p.id === "zodiacgems")!.kind = "personal";
    const issues = ofKind(c, "kind-link-mismatch");
    expect(issues.map((i) => i.href).sort()).toEqual([
      "/admin/projects/siteplus",
      "/admin/projects/skg-coa",
      "/admin/projects/zodiacgems",
    ]);
    expect(issues.every((i) => i.severity === "warning")).toBe(true);
  });

  it("a role without a CV is an error", () => {
    const c = clone();
    c.roles[0].cvFileUrl = "";
    expect(ofKind(c, "missing-cv")).toEqual([
      expect.objectContaining({ severity: "error", href: "/admin/roles" }),
    ]);
  });

  it("health: no stale-order warning after migration", () => {
    expect(ofKind(base, "stale-order")).toEqual([]);
    expect(base.roles.every((r) => r.experienceOrder.length > 0)).toBe(true);
  });

  it("stale order flags unknown ids only", () => {
    const c = clone();
    c.roles[0].experienceOrder = [...c.roles[0].experienceOrder, "ghost"];
    expect(ofKind(c, "stale-order")).toHaveLength(1);
    const d = clone();
    d.roles[0].experienceOrder = d.roles[0].experienceOrder.slice(1);
    expect(ofKind(d, "stale-order")).toHaveLength(0);
  });

  it("hidden items are info, counted per list", () => {
    const c = clone();
    c.certificates[0].published = false;
    c.certificates[1].published = false;
    expect(ofKind(c, "hidden-items")).toEqual([
      expect.objectContaining({
        severity: "info",
        count: 2,
        href: "/admin/certificates",
      }),
    ]);
  });

  it("flags a case study with an empty English part", () => {
    const c = clone();
    const project = c.projects.find((p) => p.caseStudy)!;
    project.caseStudy!.result.en = "";
    expect(ofKind(c, "empty-case-study")).toEqual([
      expect.objectContaining({ href: `/admin/projects/${project.id}` }),
    ]);
  });

  it("does not throw on sparse content", () => {
    const c = clone();
    const sparse: Content = {
      ...c,
      whyCards: [],
      certificates: [],
      roles: c.roles.map((r) => ({ ...r, experienceOrder: [] })),
      education: c.education.map((e) => ({ ...e, notes: null })),
    };
    expect(Array.isArray(checkContentHealth(sparse))).toBe(true);
  });

  it("sorts errors before warnings before info", () => {
    const c = clone();
    c.roles[0].cvFileUrl = "";
    c.certificates[0].published = false;
    const order = checkContentHealth(c).map((i) => i.severity);
    const rank = { error: 0, warning: 1, info: 2 } as const;
    expect(order).toEqual([...order].sort((a, b) => rank[a] - rank[b]));
    expect(order[0]).toBe("error");
    expect(order.at(-1)).toBe("info");
  });
});

describe("translationStats", () => {
  it("counts nested i18n leaves that have English", () => {
    expect(
      translationStats({
        a: { en: "x", ja: "", vi: "y" },
        b: [{ en: "z", ja: "z", vi: "" }],
        c: { en: "", ja: "", vi: "" },
      }),
    ).toEqual({ total: 2, ja: 1, vi: 1 });
  });
});

describe("evidenceOf", () => {
  it("splits evidence into visible and hidden items", () => {
    const c = clone();
    const skill = c.skills.find((s) => s.projectIds.length >= 2)!;
    c.projects.find((p) => p.id === skill.projectIds[0])!.published = false;
    const ev = evidenceOf(skill, c);
    expect(ev.hidden).toBe(1);
    expect(ev.visible).toBe(
      skill.experienceIds.length + skill.projectIds.length - 1,
    );
  });
});
