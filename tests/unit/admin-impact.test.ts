import { describe, expect, it } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { deleteImpact } from "@/lib/admin/impact";

const c = contentSchema.parse(seed);

describe("deleteImpact", () => {
  it("names the roles and the projects that a stint delete touches", () => {
    const lines = deleteImpact("experiences", "skg-engineer", c);
    const projects = c.projects.filter(
      (p) => p.experienceId === "skg-engineer",
    );
    expect(projects).toHaveLength(3);
    expect(lines).toContain(
      `Còn 3 dự án thuộc mục này, phải chuyển hoặc xoá chúng trước (xoá sẽ bị từ chối)`,
    );
    expect(lines).toContain(
      `Vai trò "${c.roles[0].title.en}" có mục này trong thứ tự kinh nghiệm`,
    );
  });

  it("names the why card that points at a tree parent only when the parent goes away with the stint", () => {
    const withCard = (cc: typeof c) => ({
      ...cc,
      whyCards: cc.whyCards.map((w, i) =>
        i === 0 ? { ...w, evidenceLink: "#exp-skg-software" } : w,
      ),
    });
    const card = `Why card "${c.whyCards[0].title.en}" đang trỏ tới mục này`;
    // The other SKG stint keeps the parent row alive.
    expect(
      deleteImpact("experiences", "skg-intern", withCard(c)),
    ).not.toContain(card);
    const lone = withCard({
      ...c,
      experiences: c.experiences.filter((e) => e.id !== "skg-intern"),
    });
    expect(deleteImpact("experiences", "skg-engineer", lone)).toContain(card);
  });

  it("names the projects that keep a school", () => {
    expect(deleteImpact("education", "fpt-university", c)).toContain(
      "Còn 3 dự án thuộc mục này, phải chuyển hoặc xoá chúng trước (xoá sẽ bị từ chối)",
    );
  });

  it("names the why card, the skill links and nothing about roles for a project", () => {
    const lines = deleteImpact("projects", "skg-flexybox-p2", c);
    const links = c.skills.filter((s) =>
      s.projectIds.includes("skg-flexybox-p2"),
    ).length;
    expect(links).toBeGreaterThan(0);
    expect(lines).toContain(`Mất ${links} liên kết kỹ năng`);
    expect(lines).toContain(
      `Why card "${c.whyCards[0].title.en}" đang trỏ tới mục này`,
    );
    expect(lines.some((l) => l.startsWith("Vai trò"))).toBe(false);
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
