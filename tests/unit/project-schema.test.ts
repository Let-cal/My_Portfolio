import { describe, expect, it } from "vitest";
import { projectSchema, whyCardSchema } from "@/content/schema";

const base = {
  id: "demo",
  title: "Demo",
  role: { en: "Developer" },
  start: "2025-01",
  end: null,
  summary: { en: "A demo project" },
  caseStudy: null,
  tech: [],
  demoUrl: null,
  repoUrls: [],
  posterUrl: null,
  videoUrl: null,
  published: true,
  sortIndex: 0,
  experienceId: null,
  educationId: null,
  kind: "personal",
  featured: false,
  featuredOrder: null,
  roles: [],
  teamSize: null,
  links: [],
};

describe("project schema: where a project belongs", () => {
  it("rejects work without experienceId", () => {
    const r = projectSchema.safeParse({ ...base, kind: "work" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe(
        "kind must match where the project belongs",
      );
    }
  });

  it("rejects university with experienceId", () => {
    const r = projectSchema.safeParse({
      ...base,
      kind: "university",
      educationId: "hust",
      experienceId: "skg-coa",
    });
    expect(r.success).toBe(false);
  });

  it("rejects university without educationId", () => {
    expect(
      projectSchema.safeParse({ ...base, kind: "university" }).success,
    ).toBe(false);
  });

  it("rejects personal that points at a stint or a school", () => {
    expect(
      projectSchema.safeParse({ ...base, experienceId: "skg-coa" }).success,
    ).toBe(false);
    expect(
      projectSchema.safeParse({ ...base, educationId: "hust" }).success,
    ).toBe(false);
  });

  it("accepts work with an experienceId and university with an educationId", () => {
    expect(
      projectSchema.safeParse({
        ...base,
        kind: "work",
        experienceId: "skg-coa",
      }).success,
    ).toBe(true);
    expect(
      projectSchema.safeParse({
        ...base,
        kind: "university",
        educationId: "hust",
      }).success,
    ).toBe(true);
  });

  it("accepts personal with no links", () => {
    expect(projectSchema.safeParse(base).success).toBe(true);
  });

  it("defaults the new fields so older content still parses", () => {
    const {
      experienceId: _e,
      educationId: _s,
      kind: _k,
      featured: _f,
      featuredOrder: _o,
      roles: _r,
      teamSize: _t,
      links: _l,
      ...old
    } = base;
    void [_e, _s, _k, _f, _o, _r, _t, _l];
    const r = projectSchema.parse(old);
    expect(r).toMatchObject({
      experienceId: null,
      educationId: null,
      kind: "personal",
      featured: false,
      featuredOrder: null,
      roles: [],
      teamSize: null,
      links: [],
    });
  });

  it("roles only accept role keys", () => {
    expect(
      projectSchema.safeParse({ ...base, roles: ["fullstack", "pm"] }).success,
    ).toBe(true);
    expect(
      projectSchema.safeParse({ ...base, roles: ["designer"] }).success,
    ).toBe(false);
  });
});

describe("why card evidence link", () => {
  const card = {
    id: "c",
    title: { en: "t" },
    subtitle: { en: "s" },
    tag: { en: "g" },
    body: { en: "b" },
    colors: ["#000000", "#ffffff"],
    evidenceLink: "#tree-skg-coa",
    sortIndex: 0,
  };
  it("accepts a #tree- anchor", () => {
    expect(whyCardSchema.safeParse(card).success).toBe(true);
  });
  it("still accepts #exp- and #proj- anchors and rejects others", () => {
    expect(
      whyCardSchema.safeParse({ ...card, evidenceLink: "#exp-skg-coa" })
        .success,
    ).toBe(true);
    expect(
      whyCardSchema.safeParse({ ...card, evidenceLink: "#proj-demo" }).success,
    ).toBe(true);
    expect(
      whyCardSchema.safeParse({ ...card, evidenceLink: "#other-x" }).success,
    ).toBe(false);
  });
});
