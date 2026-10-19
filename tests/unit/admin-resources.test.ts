import { describe, expect, it } from "vitest";
import { contentSchema, profileSchema, roleSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { RESOURCE_KEYS, resources, i18nFields, type ResourceKey } from "@/lib/admin/resources";
import { PROFILE_FIELDS, ROLE_FIELDS } from "@/lib/admin/singletons";

const content = contentSchema.parse(seed);
const firstItem: Record<ResourceKey, unknown> = {
  experiences: content.experiences[0],
  projects: content.projects[0],
  skills: content.skills[0],
  certificates: content.certificates[0],
  activities: content.activities[0],
  education: content.education[0],
  why_cards: content.whyCards[0],
};

describe.each(RESOURCE_KEYS)("resource %s", (key) => {
  const resource = resources[key];

  it("its schema accepts the first seed item", () => {
    expect(resource.schema.safeParse(firstItem[key]).success).toBe(true);
  });

  it("its form edits every field except the drag-and-drop position", () => {
    const schemaKeys = Object.keys(resource.schema.shape).filter((k) => k !== "sortIndex").sort();
    expect(resource.fields.map((f) => f.name).sort()).toEqual(schemaKeys);
  });

  it("names only real fields as translated or listed", () => {
    for (const name of [...i18nFields(key), ...resource.listColumns]) {
      expect(Object.keys(resource.schema.shape)).toContain(name);
    }
  });

  it("round-trips the first seed item through its row mapper", () => {
    const item = firstItem[key];
    expect(resource.fromRow(resource.toRow(item as Record<string, unknown>), [])).toMatchObject(
      key === "skills" ? { ...(item as object), experienceIds: [], projectIds: [] } : (item as object),
    );
  });

  it("knows whether visitors can hide its rows", () => {
    expect(resource.hasPublished).toBe("published" in resource.schema.shape);
  });
});

describe("profile", () => {
  it("rejects a phone field", () => {
    expect(profileSchema.safeParse({ ...content.profile, phone: "0123" }).success).toBe(false);
  });
});

describe("profile and role forms", () => {
  const topLevel = (names: string[]) => [...new Set(names.map((n) => n.split(".")[0]))].sort();

  it("the profile form edits every profile field, including each role summary", () => {
    expect(topLevel(PROFILE_FIELDS.map((f) => f.name))).toEqual(Object.keys(profileSchema.shape).sort());
    const summaries = PROFILE_FIELDS.filter((f) => f.name.startsWith("summaries.")).map((f) => f.name.split(".")[1]);
    expect(summaries.sort()).toEqual(Object.keys(content.profile.summaries).sort());
  });

  it("the role form edits every role field except its fixed key", () => {
    expect(ROLE_FIELDS.map((f) => f.name).sort()).toEqual(
      Object.keys(roleSchema.shape).filter((k) => k !== "key").sort(),
    );
  });
});
