import { describe, expect, it } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { deleteImpact } from "@/lib/admin/impact";

const c = contentSchema.parse(seed);

describe("deleteImpact", () => {
  it("names why cards, roles and links that an experience delete touches", () => {
    const lines = deleteImpact("experiences", "skg-flexybox-p2", c);
    const links = c.skills.filter((s) =>
      s.experienceIds.includes("skg-flexybox-p2"),
    ).length;
    expect(lines).toContain(`Mất ${links} liên kết kỹ năng`);
    expect(lines).toContain(
      `Why card "${c.whyCards[0].title.en}" đang trỏ tới mục này`,
    );
    expect(lines).toContain(
      `Vai trò "${c.roles[0].title.en}" có mục này trong thứ tự kinh nghiệm`,
    );
  });

  it("names the why card that points at a project", () => {
    expect(deleteImpact("projects", "siteplus", c)).toContain(
      `Why card "${c.whyCards[3].title.en}" đang trỏ tới mục này`,
    );
  });

  it("is empty for a skill without evidence", () => {
    expect(deleteImpact("skills", "jest", c)).toEqual([]);
  });

  it("counts a skill's evidence links", () => {
    const react = c.skills.find((s) => s.id === "react")!;
    expect(deleteImpact("skills", "react", c)).toEqual([
      `Mất ${react.experienceIds.length + react.projectIds.length} liên kết kỹ năng`,
    ]);
  });
});
