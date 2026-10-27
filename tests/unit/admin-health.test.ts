import { describe, expect, it } from "vitest";
import { contentSchema, type Content } from "@/content/schema";
// Content as before the experience tree migration, until this test moves to the new model.
import seed from "../fixtures/seed-before-experience-tree.json";
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
      (s) => s.experienceIds.length === 1 && s.projectIds.length === 0,
    )!;
    c.experiences.find((e) => e.id === skill.experienceIds[0])!.published =
      false;
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
    const target = d.whyCards.find((w) => w.evidenceLink?.startsWith("#exp-"))!;
    d.experiences.find(
      (e) => `#exp-${e.id}` === target.evidenceLink,
    )!.published = false;
    expect(ofKind(d, "broken-evidence")).toHaveLength(1);
  });

  it("a role without a CV is an error", () => {
    const c = clone();
    c.roles[0].cvFileUrl = "";
    expect(ofKind(c, "missing-cv")).toEqual([
      expect.objectContaining({ severity: "error", href: "/admin/roles" }),
    ]);
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
    const exp = c.experiences.find((e) => e.caseStudy)!;
    exp.caseStudy!.result.en = "";
    expect(ofKind(c, "empty-case-study")).toEqual([
      expect.objectContaining({ href: `/admin/experiences/${exp.id}` }),
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
    const skill = c.skills.find((s) => s.experienceIds.length >= 2)!;
    c.experiences.find((e) => e.id === skill.experienceIds[0])!.published =
      false;
    const ev = evidenceOf(skill, c);
    expect(ev.hidden).toBe(1);
    expect(ev.visible).toBe(
      skill.experienceIds.length + skill.projectIds.length - 1,
    );
  });
});
