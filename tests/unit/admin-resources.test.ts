import { describe, expect, it } from "vitest";
import { contentSchema, profileSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { RESOURCE_KEYS, resources, i18nFields, type ResourceKey } from "@/lib/admin/resources";

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
