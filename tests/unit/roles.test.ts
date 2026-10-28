import { describe, expect, it } from "vitest";
import { contentSchema, SKILL_GROUPS } from "@/content/schema";
import seed from "@/content/seed.json";
import { orderExperiences, orderSkillGroups, parseRole } from "@/lib/roles";

const content = contentSchema.parse(seed);
const role = (key: string) => content.roles.find((r) => r.key === key)!;

describe("parseRole", () => {
  it("accepts the three role keys", () => {
    expect(parseRole("pm")).toBe("pm");
    expect(parseRole("techlead")).toBe("techlead");
    expect(parseRole("fullstack")).toBe("fullstack");
  });
  it("defaults to fullstack", () => {
    expect(parseRole("xyz")).toBe("fullstack");
    expect(parseRole(null)).toBe("fullstack");
    expect(parseRole(undefined)).toBe("fullstack");
    expect(parseRole("")).toBe("fullstack");
  });
});

describe("orderExperiences", () => {
  // Since the experience tree migration the experiences are stints and roles.experienceOrder lists stint ids.
  it("puts the stints in the role order: engineer, then intern, then the rest", () => {
    for (const key of ["pm", "techlead", "fullstack"]) {
      expect(
        orderExperiences(content.experiences, role(key)).map((e) => e.id),
      ).toEqual(["skg-engineer", "skg-intern", "fpt-japan"]);
    }
  });
  it("follows a role order that differs", () => {
    const r = {
      ...role("pm"),
      experienceOrder: ["skg-intern", "skg-engineer"],
    };
    expect(orderExperiences(content.experiences, r).map((e) => e.id)).toEqual([
      "skg-intern",
      "skg-engineer",
      "fpt-japan",
    ]);
  });
  it("drops unpublished entries", () => {
    const exps = content.experiences.map((e) =>
      e.id === "skg-engineer" ? { ...e, published: false } : e,
    );
    const ids = orderExperiences(exps, role("pm")).map((e) => e.id);
    expect(ids).not.toContain("skg-engineer");
    expect(ids[0]).toBe("skg-intern");
  });
  it("appends entries missing from the role order by sortIndex", () => {
    const r = { ...role("pm"), experienceOrder: ["fpt-japan"] };
    const ids = orderExperiences(content.experiences, r).map((e) => e.id);
    expect(ids[0]).toBe("fpt-japan");
    const rest = content.experiences
      .filter((e) => e.id !== "fpt-japan")
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map((e) => e.id);
    expect(ids.slice(1)).toEqual(rest);
  });
  it("does not mutate its input", () => {
    const before = content.experiences.map((e) => e.id);
    orderExperiences(content.experiences, role("pm"));
    expect(content.experiences.map((e) => e.id)).toEqual(before);
  });
});

describe("orderSkillGroups", () => {
  it("starts with the pm order and lists all 8 groups once", () => {
    const groups = orderSkillGroups(role("pm"));
    expect(groups.slice(0, 3)).toEqual(["delivery", "cloud", "languages"]);
    expect(groups).toHaveLength(8);
    expect(new Set(groups).size).toBe(8);
  });
  it("appends missing groups in declaration order", () => {
    const groups = orderSkillGroups({
      ...role("pm"),
      skillGroupOrder: ["design"],
    });
    expect(groups[0]).toBe("design");
    expect(groups.slice(1)).toEqual(SKILL_GROUPS.filter((g) => g !== "design"));
  });
});
