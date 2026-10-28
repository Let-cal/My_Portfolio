import { describe, expect, it } from "vitest";
import { contentSchema, type Content } from "@/content/schema";
import seed from "@/content/seed.json";
import { evidenceFor, skillsInGroup } from "@/lib/skills";

const content: Content = contentSchema.parse(seed);

describe("evidenceFor", () => {
  it("lists the experiences that used the skill", () => {
    const { experiences } = evidenceFor("requirements-definition", content);
    expect(experiences.map((e) => e.id)).toEqual(["fpt-japan"]);
  });

  it("lists projects as well as experiences", () => {
    const { experiences, projects } = evidenceFor(
      "requirements-definition",
      content,
    );
    expect(experiences.map((e) => e.id)).toEqual(["fpt-japan"]);
    expect(projects.map((p) => p.id)).toEqual(
      expect.arrayContaining(["skg-ai-agent", "skg-flexybox-p2"]),
    );
    expect(evidenceFor("terraform", content)).toEqual({
      experiences: [],
      projects: [expect.objectContaining({ id: "skg-ai-agent" })],
    });
  });

  it("returns the full records, ordered by sortIndex", () => {
    const { projects } = evidenceFor("react", content);
    expect(projects.length).toBeGreaterThan(1);
    expect(projects.map((p) => p.id)).toEqual(
      projects
        .slice()
        .sort((a, b) => a.sortIndex - b.sortIndex)
        .map((p) => p.id),
    );
    expect(projects[0]).toHaveProperty("title");
    expect(
      evidenceFor("requirements-definition", content).experiences[0],
    ).toHaveProperty("position");
  });

  it("drops unpublished experiences and projects", () => {
    const hidden: Content = {
      ...content,
      experiences: content.experiences.map((e) =>
        e.id === "fpt-japan" ? { ...e, published: false } : e,
      ),
      projects: content.projects.map((p) =>
        p.id === "siteplus" ? { ...p, published: false } : p,
      ),
    };
    expect(evidenceFor("requirements-definition", hidden).experiences).toEqual(
      [],
    );
    expect(
      evidenceFor("react", hidden).projects.map((p) => p.id),
    ).not.toContain("siteplus");
  });

  it("ignores ids that point at nothing, and unknown skills", () => {
    const dangling: Content = {
      ...content,
      skills: content.skills.map((s) =>
        s.id === "requirements-definition"
          ? { ...s, experienceIds: ["nope", "fpt-japan"] }
          : s,
      ),
    };
    expect(
      evidenceFor("requirements-definition", dangling).experiences.map(
        (e) => e.id,
      ),
    ).toEqual(["fpt-japan"]);
    expect(evidenceFor("does-not-exist", content)).toEqual({
      experiences: [],
      projects: [],
    });
  });

  it("returns nothing for a skill without links", () => {
    expect(evidenceFor("framer-motion", content)).toEqual({
      experiences: [],
      projects: [],
    });
  });
});

describe("skillsInGroup", () => {
  it("returns the group's skills by sortIndex", () => {
    const skills = skillsInGroup("databases", content);
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.every((s) => s.group === "databases")).toBe(true);
    expect(skills.map((s) => s.sortIndex)).toEqual(
      skills.map((s) => s.sortIndex).sort((a, b) => a - b),
    );
  });
});
