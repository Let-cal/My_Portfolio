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
  it("puts the pm order first", () => {
    expect(orderExperiences(content.experiences, role("pm"))[0].id).toBe(
      "skg-ai-agent",
    );
  });
  it("puts the techlead order first", () => {
    expect(orderExperiences(content.experiences, role("techlead"))[0].id).toBe(
      "skg-flexybox-p1",
    );
  });
  it("drops unpublished entries", () => {
    const exps = content.experiences.map((e) =>
      e.id === "skg-ai-agent" ? { ...e, published: false } : e,
    );
    const ids = orderExperiences(exps, role("pm")).map((e) => e.id);
    expect(ids).not.toContain("skg-ai-agent");
    expect(ids[0]).toBe("skg-flexybox-p2");
  });
  it("appends entries missing from the role order by sortIndex", () => {
    const r = { ...role("pm"), experienceOrder: ["skg-coa"] };
    const ids = orderExperiences(content.experiences, r).map((e) => e.id);
    expect(ids[0]).toBe("skg-coa");
    const rest = content.experiences
      .filter((e) => e.id !== "skg-coa")
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
