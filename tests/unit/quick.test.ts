import { describe, expect, it } from "vitest";
import { contentSchema, LOCALES, ROLE_KEYS } from "@/content/schema";
import seed from "@/content/seed.json";
import { buildQuickData, displayUrl, featuredCertificates } from "@/lib/quick";

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

  it("lists the first four experiences of the role, in the role order", () => {
    expect(
      buildQuickData(content, "en", "pm").experiences.map((e) => e.id),
    ).toEqual([
      "skg-ai-agent",
      "skg-flexybox-p2",
      "skg-coa",
      "skg-flexybox-p1",
    ]);
    expect(buildQuickData(content, "en", "techlead").experiences[0].id).toBe(
      "skg-flexybox-p1",
    );
  });

  it("prints a shared employer once, and per line only when the employers differ", () => {
    const d = buildQuickData(content, "en", "pm");
    expect(d.employer).toBe("SKG Software (Splus)");
    expect(d.experiences.every((e) => e.parentCompany === null)).toBe(true);
    const mixed = {
      ...content,
      experiences: content.experiences.map((e) =>
        e.id === "skg-coa" ? { ...e, parentCompany: "Other Co" } : e,
      ),
    };
    const m = buildQuickData(mixed, "en", "pm");
    expect(m.employer).toBeNull();
    expect(m.experiences.find((e) => e.id === "skg-coa")?.parentCompany).toBe(
      "Other Co",
    );
  });

  it("never prints Present for SKG and has a period for every entry", () => {
    for (const role of ROLE_KEYS) {
      for (const e of buildQuickData(content, "en", role).experiences) {
        expect(e.period).toMatch(/\d{4}/);
        expect(e.period).not.toMatch(/present/i);
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
        expect(d.experiences).toHaveLength(4);
        expect(d.education?.school).toBe("FPT University");
      }
    }
  });
});
