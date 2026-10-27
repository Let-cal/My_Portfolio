import { describe, expect, it } from "vitest";
import { contentSchema, type Content, type Project } from "@/content/schema";
import seed from "@/content/seed.json";
import { buildJourney, groupSlug } from "@/lib/journey";

const base = (): Content => contentSchema.parse(structuredClone(seed));
const t = (key: string) => ({ code: "Code", demo: "Demo" })[key] ?? `[${key}]`;

const personal: Project = {
  ...base().projects[0],
  id: "side-project",
  kind: "personal",
  experienceId: null,
  educationId: null,
  featured: false,
  featuredOrder: null,
};

describe("buildJourney", () => {
  it("SKG parent first, expanded data has 5 children newest first", () => {
    const journey = buildJourney(base(), "en", t);
    const skg = journey[0];
    expect(skg).toMatchObject({
      kind: "company",
      name: "SKG Software (Splus)",
      anchor: "exp-skg-software",
      location: "Ho Chi Minh City, Vietnam",
      period: "Aug 2025 – Sep 2026",
      chip: { count: 5 },
    });
    expect(skg.children.map((c) => c.id)).toEqual([
      "skg-ai-agent",
      "skg-flexybox-p2",
      "skg-coa",
      "skg-flexybox-p1",
      "tongue-ai-driver-ms",
    ]);
    expect(skg.children.map((c) => c.anchor)).toEqual([
      "tree-skg-ai-agent",
      "tree-skg-flexybox-p2",
      "tree-skg-coa",
      "tree-skg-flexybox-p1",
      "tree-tongue-ai-driver-ms",
    ]);
    // header lists the stints, newest first
    expect(skg.lines.map((l) => l.period)).toEqual([
      "Oct 2025 – Sep 2026",
      "Aug 2025 – Oct 2025",
    ]);
    expect(skg.lines[1].title).toBe("Software Engineer Intern");
    // stint summaries are empty in the seed: the header shows none
    expect(skg.summary).toBeNull();
  });

  it("orders parents by latest end", () => {
    expect(buildJourney(base(), "en", t).map((p) => p.anchor)).toEqual([
      "exp-skg-software",
      "exp-fpt-university",
      "exp-fpt-japan",
    ]);
  });

  it("puts an open-ended parent first", () => {
    const c = base();
    c.education[0].end = null;
    expect(buildJourney(c, "en", t)[0].anchor).toBe("exp-fpt-university");
  });

  it("FPT University parent has 3 university children", () => {
    const uni = buildJourney(base(), "en", t).find(
      (p) => p.anchor === "exp-fpt-university",
    )!;
    expect(uni).toMatchObject({
      kind: "school",
      name: "FPT University",
      location: null,
      period: "Sep 2021 – May 2025",
      chip: { count: 3 },
    });
    expect(uni.lines).toEqual([
      {
        title: "Bachelor of Information Technology · Software Engineering",
        period: "Sep 2021 – May 2025",
      },
    ]);
    expect(uni.summary).toBe("Half-tuition scholarship (July 2021)");
    expect(uni.children.map((c) => c.id)).toEqual([
      "siteplus",
      "zodiacgems",
      "meet-my-lecturer",
    ]);
  });

  it("FPT Japan has no children and keeps its summary", () => {
    const fpt = buildJourney(base(), "en", t).find(
      (p) => p.anchor === "exp-fpt-japan",
    )!;
    expect(fpt.children).toEqual([]);
    expect(fpt.chip).toEqual({ label: "internship" });
    expect(fpt.name).toBe("FPT Japan");
    expect(fpt.location).toBe("Tokyo, Japan");
    expect(fpt.summary).toContain("Business analysis internship in Tokyo");
    expect(fpt.lines).toEqual([
      { title: "Business Analyst Intern / UI-UX Designer", period: "Mar 2024" },
    ]);
  });

  it("personal projects never in the journey", () => {
    const c = base();
    c.projects.push(personal);
    const ids = buildJourney(c, "en", t).flatMap((p) =>
      p.children.map((ch) => ch.id),
    );
    expect(ids).not.toContain("side-project");
    expect(ids).toHaveLength(8);
  });

  it("journey falls back to en", () => {
    const c = base();
    // JA/VI empty everywhere a new field can be empty
    for (const e of c.experiences) {
      e.position = { en: e.position.en, ja: "", vi: "" };
      e.summary = { en: e.summary.en, ja: "", vi: undefined };
    }
    for (const p of c.projects) {
      p.role = { en: p.role.en, ja: "" };
      p.summary = { en: p.summary.en, vi: "" };
    }
    c.education[0].notes = { en: "Scholarship", ja: "" };
    c.education[0].degree = { en: "Bachelor", ja: "" };
    c.education[0].major = { en: "Software Engineering", ja: "" };
    const en = buildJourney(c, "en", t);
    for (const locale of ["ja", "vi"] as const) {
      const j = buildJourney(c, locale, t);
      const texts = j.flatMap((p) => [
        p.name,
        ...p.lines.map((l) => l.title),
        ...(p.summary ? [p.summary] : []),
        ...p.children.flatMap((ch) => [ch.title, ch.role, ch.summary]),
      ]);
      expect(texts.every((s) => s.length > 0)).toBe(true);
      expect(j.map((p) => p.lines.map((l) => l.title))).toEqual(
        en.map((p) => p.lines.map((l) => l.title)),
      );
      expect(j[1].summary).toBe("Scholarship");
    }
  });

  it("uses the requested locale when it has text", () => {
    const j = buildJourney(base(), "vi", t);
    expect(j[0].lines[1].title).toBe("Thực tập sinh kỹ sư phần mềm");
  });

  it("unpublished stint hides its projects", () => {
    const c = base();
    c.experiences.find((e) => e.id === "skg-intern")!.published = false;
    const skg = buildJourney(c, "en", t)[0];
    expect(skg.children.map((ch) => ch.id)).toEqual([
      "skg-ai-agent",
      "skg-flexybox-p2",
      "skg-coa",
    ]);
    expect(skg.chip).toEqual({ count: 3 });
    expect(skg.lines).toHaveLength(1);
    expect(skg.period).toBe("Oct 2025 – Sep 2026");
    // the projects themselves stay published (they still belong in /projects)
    expect(c.projects.find((p) => p.id === "skg-flexybox-p1")!.published).toBe(
      true,
    );
  });

  it("drops a company whose stints are all unpublished", () => {
    const c = base();
    for (const e of c.experiences)
      if (e.company.startsWith("SKG")) e.published = false;
    const anchors = buildJourney(c, "en", t).map((p) => p.anchor);
    expect(anchors).toEqual(["exp-fpt-university", "exp-fpt-japan"]);
  });

  it("hides unpublished projects and projects of a missing school", () => {
    const c = base();
    c.projects.find((p) => p.id === "skg-coa")!.published = false;
    c.projects.find((p) => p.id === "siteplus")!.educationId = "nowhere";
    const j = buildJourney(c, "en", t);
    expect(j[0].children.map((ch) => ch.id)).not.toContain("skg-coa");
    expect(
      j.find((p) => p.kind === "school")!.children.map((ch) => ch.id),
    ).toEqual(["zodiacgems", "meet-my-lecturer"]);
  });

  it("groups by parent company, otherwise by company", () => {
    const c = base();
    const eng = c.experiences.find((e) => e.id === "skg-engineer")!;
    eng.parentCompany = null; // now its own group named by `company`
    eng.company = "SKG Engineering";
    const j = buildJourney(c, "en", t);
    expect(j.map((p) => p.name).sort()).toEqual([
      "FPT Japan",
      "FPT University",
      "SKG Engineering",
      "SKG Software (Splus)",
    ]);
    const kids = Object.fromEntries(j.map((p) => [p.name, p.children.length]));
    expect(kids["SKG Engineering"]).toBe(3);
    expect(kids["SKG Software (Splus)"]).toBe(2);
  });

  it("keeps title, period, role, summary, tech, team size and links on a child", () => {
    const c = base();
    const p = c.projects.find((x) => x.id === "skg-coa")!;
    p.teamSize = "4 people";
    p.demoUrl = "https://example.invalid/demo";
    p.repoUrls = ["https://example.invalid/code"];
    p.links = [{ label: "Docs", url: "https://example.invalid/docs" }];
    const child = buildJourney(c, "en", t)[0].children.find(
      (ch) => ch.id === "skg-coa",
    )!;
    expect(child).toMatchObject({
      title: p.title,
      role: p.role.en,
      period: "Oct 2025 – Mar 2026",
      summary: p.summary.en,
      tech: p.tech,
      teamSize: "4 people",
      roles: ["fullstack", "techlead"],
    });
    expect(child.links).toEqual([
      { label: "Demo", url: "https://example.invalid/demo" },
      { label: "Code", url: "https://example.invalid/code" },
      { label: "Docs", url: "https://example.invalid/docs" },
    ]);
  });

  it("picks the case study text for the locale", () => {
    const c = base();
    const p = c.projects.find((x) => x.id === "skg-coa")!;
    p.caseStudy = {
      problem: { en: "P", ja: "" },
      role: { en: "R", vi: "Rv" },
      decisions: { en: "D" },
      result: { en: "Res" },
    };
    const child = buildJourney(c, "vi", t)[0].children.find(
      (ch) => ch.id === "skg-coa",
    )!;
    expect(child.caseStudy).toEqual({
      problem: "P",
      role: "Rv",
      decisions: "D",
      result: "Res",
    });
    p.caseStudy = null;
    expect(
      buildJourney(c, "en", t)[0].children.find((ch) => ch.id === "skg-coa")!
        .caseStudy,
    ).toBeNull();
  });

  it("numbers several repositories", () => {
    const c = base();
    const p = c.projects.find((x) => x.id === "skg-coa")!;
    p.demoUrl = null;
    p.repoUrls = ["https://example.invalid/a", "https://example.invalid/b"];
    p.links = [];
    const child = buildJourney(c, "en", t)[0].children.find(
      (ch) => ch.id === "skg-coa",
    )!;
    expect(child.links.map((l) => l.label)).toEqual(["Code 1", "Code 2"]);
  });

  it("merges stint tech and summaries into the parent header", () => {
    const c = base();
    const eng = c.experiences.find((e) => e.id === "skg-engineer")!;
    const intern = c.experiences.find((e) => e.id === "skg-intern")!;
    eng.tech = ["Next.js", "Go"];
    intern.tech = ["Go", "Python"];
    eng.summary = { en: "Engineer." };
    intern.summary = { en: "Intern." };
    const skg = buildJourney(c, "en", t)[0];
    expect(skg.tech).toEqual(["Next.js", "Go", "Python"]);
    expect(skg.summary).toBe("Engineer.\n\nIntern.");
  });
});

describe("groupSlug", () => {
  it("drops a parenthesised suffix, accents and punctuation", () => {
    expect(groupSlug("SKG Software (Splus)")).toBe("skg-software");
    expect(groupSlug("FPT University")).toBe("fpt-university");
    expect(groupSlug("  Đại học  FPT — Hà Nội ")).toBe("dai-hoc-fpt-ha-noi");
    expect(groupSlug("A&B  Co.")).toBe("a-b-co");
  });

  it("returns null when nothing usable is left", () => {
    expect(groupSlug("株式会社")).toBeNull();
  });

  it("uses the first stint id when the name has no slug", () => {
    const c = base();
    c.experiences.find((e) => e.id === "fpt-japan")!.company = "日本株式会社";
    const anchors = buildJourney(c, "en", t).map((p) => p.anchor);
    expect(anchors).toContain("exp-fpt-japan");
  });
});
