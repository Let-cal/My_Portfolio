import { describe, expect, it } from "vitest";
import { contentSchema, profileSchema, type Content } from "@/content/schema";
import seed from "@/content/seed.json";

/** The two SKG position stints and their end dates. */
const SKG_ENDS: Record<string, string> = {
  "skg-engineer": "2026-09",
  "skg-intern": "2025-10",
};

/** The SKG projects (moved from experiences) and their end dates. */
const SKG_PROJECT_ENDS: Record<string, string> = {
  "skg-ai-agent": "2026-09",
  "skg-flexybox-p2": "2026-09",
  "skg-coa": "2026-03",
  "skg-flexybox-p1": "2025-10",
  "tongue-ai-driver-ms": "2025-09",
};

describe("content schema", () => {
  const content: Content = contentSchema.parse(seed);

  it("parses the seed without throwing", () => {
    expect(() => contentSchema.parse(seed)).not.toThrow();
  });

  it("has the 3 roles with matching koi varieties", () => {
    const pairs = content.roles.map((r) => [r.key, r.koiVariety]);
    expect(pairs).toEqual(
      expect.arrayContaining([
        ["fullstack", "kohaku"],
        ["techlead", "showa"],
        ["pm", "ogon"],
      ]),
    );
    expect(content.roles).toHaveLength(3);
  });

  it("has all required experience ids", () => {
    const ids = content.experiences.map((e) => e.id);
    for (const id of [...Object.keys(SKG_ENDS), "fpt-japan"]) {
      expect(ids).toContain(id);
    }
  });

  it("groups every skg-* experience under SKG with the fixed end date", () => {
    const skg = content.experiences.filter((e) => e.id.startsWith("skg-"));
    expect(skg).toHaveLength(2);
    for (const exp of skg) {
      expect(exp.parentCompany).toBe("SKG Software (Splus)");
      expect(exp.end).toBe(SKG_ENDS[exp.id]);
    }
  });

  it("keeps the SKG projects with their fixed end dates", () => {
    for (const [id, end] of Object.entries(SKG_PROJECT_ENDS)) {
      const project = content.projects.find((p) => p.id === id);
      expect(project?.kind, id).toBe("work");
      expect(project?.end, id).toBe(end);
    }
  });

  it("links skills only to existing experiences and projects", () => {
    const expIds = new Set(content.experiences.map((e) => e.id));
    const projIds = new Set(content.projects.map((p) => p.id));
    for (const skill of content.skills) {
      for (const id of skill.experienceIds)
        expect(expIds, `${skill.id} -> ${id}`).toContain(id);
      for (const id of skill.projectIds)
        expect(projIds, `${skill.id} -> ${id}`).toContain(id);
    }
  });

  it("orders roles only with existing experience ids", () => {
    const expIds = new Set(content.experiences.map((e) => e.id));
    for (const role of content.roles) {
      for (const id of role.experienceOrder)
        expect(expIds, `${role.key} -> ${id}`).toContain(id);
    }
  });

  it("points why-card evidence links at existing ids", () => {
    const anchors = new Set([
      ...content.experiences.map((e) => `#exp-${e.id}`),
      ...content.projects.map((p) => `#proj-${p.id}`),
      ...content.projects.map((p) => `#tree-${p.id}`),
    ]);
    for (const card of content.whyCards) {
      if (card.evidenceLink) expect(anchors).toContain(card.evidenceLink);
    }
  });

  it("fills en, ja and vi for every i18n text", () => {
    const missing: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (Array.isArray(node))
        return node.forEach((v, i) => walk(v, `${path}[${i}]`));
      if (node && typeof node === "object") {
        const obj = node as Record<string, unknown>;
        if (typeof obj.en === "string") {
          // An optional text left empty in every locale (a stint without a summary).
          if (!obj.en && obj.ja === undefined && obj.vi === undefined) return;
          for (const l of ["ja", "vi"]) {
            if (typeof obj[l] !== "string" || !(obj[l] as string).trim())
              missing.push(`${path}.${l}`);
          }
          return;
        }
        for (const [k, v] of Object.entries(obj)) walk(v, `${path}.${k}`);
      }
    };
    walk(seed, "seed");
    expect(missing).toEqual([]);
  });

  it("rejects a phone field on the profile", () => {
    const withPhone = { ...seed.profile, phone: "000" };
    expect(profileSchema.safeParse(withPhone).success).toBe(false);
  });
});
