import { describe, expect, it } from "vitest";
import { contentSchema, type Content } from "@/content/schema";
import seed from "@/content/seed.json";
import { evidenceFor, skillsInGroup } from "@/lib/skills";

const content: Content = contentSchema.parse(seed);

describe("evidenceFor", () => {
  it("lists the experiences that used the skill", () => {
    const { experiences, projects } = evidenceFor("terraform", content);
    expect(experiences.map((e) => e.id)).toContain("skg-ai-agent");
    expect(projects).toEqual([]);
  });

  it("lists projects as well as experiences", () => {
    const { experiences, projects } = evidenceFor("react", content);
    expect(experiences.map((e) => e.id)).toEqual(expect.arrayContaining(["skg-ai-agent", "skg-flexybox-p2"]));
    expect(projects.map((p) => p.id)).toEqual(expect.arrayContaining(["siteplus", "zodiacgems"]));
  });

  it("returns the full records, ordered by sortIndex", () => {
    const { experiences } = evidenceFor("nextjs", content);
    expect(experiences.map((e) => e.company)).toEqual(
      experiences.slice().sort((a, b) => a.sortIndex - b.sortIndex).map((e) => e.company),
    );
    expect(experiences[0]).toHaveProperty("position");
  });

  it("drops unpublished experiences and projects", () => {
    const hidden: Content = {
      ...content,
      experiences: content.experiences.map((e) => (e.id === "skg-ai-agent" ? { ...e, published: false } : e)),
      projects: content.projects.map((p) => (p.id === "siteplus" ? { ...p, published: false } : p)),
    };
    expect(evidenceFor("terraform", hidden).experiences).toEqual([]);
    expect(evidenceFor("react", hidden).projects.map((p) => p.id)).not.toContain("siteplus");
  });

  it("ignores ids that point at nothing, and unknown skills", () => {
    const dangling: Content = {
      ...content,
      skills: content.skills.map((s) => (s.id === "terraform" ? { ...s, experienceIds: ["nope", "skg-ai-agent"] } : s)),
    };
    expect(evidenceFor("terraform", dangling).experiences.map((e) => e.id)).toEqual(["skg-ai-agent"]);
    expect(evidenceFor("does-not-exist", content)).toEqual({ experiences: [], projects: [] });
  });

  it("returns nothing for a skill without links", () => {
    expect(evidenceFor("framer-motion", content)).toEqual({ experiences: [], projects: [] });
  });
});

describe("skillsInGroup", () => {
  it("returns the group's skills by sortIndex", () => {
    const skills = skillsInGroup("databases", content);
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.every((s) => s.group === "databases")).toBe(true);
    expect(skills.map((s) => s.sortIndex)).toEqual(skills.map((s) => s.sortIndex).sort((a, b) => a - b));
  });
});
