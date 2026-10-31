import { describe, expect, it } from "vitest";
import { contentSchema, LOCALES, ROLE_KEYS } from "@/content/schema";
import seed from "@/content/seed.json";
import {
  buildQuickData,
  displayUrl,
  featuredCertificates,
  QUICK_PROJECT_COUNT,
} from "@/lib/quick";

const content = contentSchema.parse(seed);

describe("displayUrl", () => {
  it("drops the scheme, www and the trailing slash", () => {
    expect(displayUrl("https://www.linkedin.com/in/letcal")).toBe(
      "linkedin.com/in/letcal",
    );
    expect(displayUrl("https://github.com/Let-cal/")).toBe(
      "github.com/Let-cal",
    );
  });
});

describe("featuredCertificates", () => {
  it("returns the four featured certificates in order", () => {
    expect(featuredCertificates(content.certificates).map((c) => c.id)).toEqual(
      [
        "jlpt-n3",
        "coursera-pm-principles",
        "coursera-sdlc",
        "coursera-ux-research-design",
      ],
    );
  });

  it("skips unpublished certificates and fills from sortIndex order", () => {
    const certs = content.certificates.map((c) =>
      c.id === "coursera-sdlc" ? { ...c, published: false } : c,
    );
    const ids = featuredCertificates(certs).map((c) => c.id);
    expect(ids).toHaveLength(4);
    expect(ids).not.toContain("coursera-sdlc");
    expect(ids.slice(0, 3)).toEqual([
      "jlpt-n3",
      "coursera-pm-principles",
      "coursera-ux-research-design",
    ]);
    expect(ids[3]).toBe("coursera-entrepreneurship");
  });

  it("returns fewer when fewer are published", () => {
    expect(
      featuredCertificates(
        content.certificates
          .slice(0, 2)
          .map((c) => ({ ...c, published: true })),
      ),
    ).toHaveLength(2);
  });
});

describe("buildQuickData", () => {
  it("uses the title, summary and CV of the chosen role", () => {
    const pm = buildQuickData(content, "en", "pm");
    expect(pm.roleTitle).toBe("Software Engineer · Technical Project Manager");
    expect(pm.summary).toContain("acting Project Manager");
    expect(pm.cvFileUrl).toMatch(/TechnicalPM\.pdf$/);
    expect(buildQuickData(content, "en", "fullstack").roleTitle).toBe(
      "Full-stack Software Engineer",
    );
  });

  const SKG_NEWEST_FIRST = [
    "skg-ai-agent",
    "skg-flexybox-p2",
    "skg-coa",
    "skg-flexybox-p1",
    "tongue-ai-driver-ms",
  ];

  it("quick lists the five SKG projects newest first", () => {
    expect(QUICK_PROJECT_COUNT).toBe(5);
    for (const role of ROLE_KEYS) {
      expect(
        buildQuickData(content, "en", role).projects.map((p) => p.id),
      ).toEqual(SKG_NEWEST_FIRST);
    }
  });

  it("prints the project title, the role in the project and its period", () => {
    const coa = buildQuickData(content, "en", "pm").projects.find(
      (p) => p.id === "skg-coa",
    )!;
    expect(coa.title).toBe("COA (Certificate of Analysis system)");
    expect(coa.role).toBe("Software Engineer, Tech Lead / Developer");
    expect(coa.period).toMatch(/2025/);
    expect(buildQuickData(content, "ja", "pm").projects[0].role).toContain(
      "ソフトウェアエンジニア",
    );
  });

  it("leaves out university and personal projects, hidden projects, and projects of a hidden stint", () => {
    const hiddenProject = {
      ...content,
      projects: content.projects.map((p) =>
        p.id === "skg-coa" ? { ...p, published: false } : p,
      ),
    };
    expect(
      buildQuickData(hiddenProject, "en", "pm").projects.map((p) => p.id),
    ).not.toContain("skg-coa");
    const hiddenStint = {
      ...content,
      experiences: content.experiences.map((e) =>
        e.id === "skg-intern" ? { ...e, published: false } : e,
      ),
    };
    expect(
      buildQuickData(hiddenStint, "en", "pm").projects.map((p) => p.id),
    ).toEqual(["skg-ai-agent", "skg-flexybox-p2", "skg-coa"]);
    for (const id of ["siteplus", "zodiacgems", "meet-my-lecturer"])
      expect(SKG_NEWEST_FIRST).not.toContain(id);
  });

  it("shows at most the limit, newest first", () => {
    const extra = {
      ...content,
      projects: [
        ...content.projects,
        {
          ...content.projects.find((p) => p.id === "skg-coa")!,
          id: "skg-newest",
          start: "2026-09",
          end: "2026-09",
        },
      ],
    };
    const ids = buildQuickData(extra, "en", "pm").projects.map((p) => p.id);
    expect(ids).toHaveLength(QUICK_PROJECT_COUNT);
    expect(ids[0]).toBe("skg-newest");
    expect(ids).not.toContain("tongue-ai-driver-ms");
  });

  it("prints a shared employer once, and per line only when the employers differ", () => {
    const d = buildQuickData(content, "en", "pm");
    expect(d.employer).toBe("SKG Software (Splus)");
    expect(d.projects.every((p) => p.employer === null)).toBe(true);
    const mixed = {
      ...content,
      experiences: content.experiences.map((e) =>
        e.id === "skg-engineer"
          ? { ...e, company: "Other Co", parentCompany: "Other Co" }
          : e,
      ),
    };
    const m = buildQuickData(mixed, "en", "pm");
    expect(m.employer).toBeNull();
    expect(m.projects.find((p) => p.id === "skg-coa")?.employer).toBe(
      "Other Co",
    );
    expect(m.projects.find((p) => p.id === "skg-flexybox-p1")?.employer).toBe(
      "SKG Software (Splus)",
    );
  });

  it("never prints Present and has a period for every project", () => {
    for (const role of ROLE_KEYS) {
      for (const p of buildQuickData(content, "en", role).projects) {
        expect(p.period).toMatch(/\d{4}/);
        expect(p.period).not.toMatch(/present/i);
      }
    }
  });

  it("orders skill groups by the role and drops empty groups", () => {
    expect(buildQuickData(content, "en", "pm").skillGroups[0].group).toBe(
      "delivery",
    );
    expect(
      buildQuickData(content, "en", "fullstack").skillGroups[0].group,
    ).toBe("languages");
    const noDelivery = {
      ...content,
      skills: content.skills.filter((s) => s.group !== "delivery"),
    };
    expect(
      buildQuickData(noDelivery, "en", "pm").skillGroups.map((g) => g.group),
    ).not.toContain("delivery");
  });

  it("has no empty text and no phone number in any locale or role", () => {
    for (const locale of LOCALES) {
      for (const role of ROLE_KEYS) {
        const d = buildQuickData(content, locale, role);
        const json = JSON.stringify(d);
        expect(json).not.toContain("undefined");
        expect(json).not.toMatch(/phone|\+?\d[\d\s().-]{8,}\d/i);
        expect(d.roleTitle).not.toBe("");
        expect(d.summary).not.toBe("");
        expect(d.certificates).toHaveLength(4);
        expect(d.projects).toHaveLength(5);
        expect(d.education?.school).toBe("FPT University");
      }
    }
  });
});
