import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuickCreate } from "@/components/admin/QuickCreate";
import { describeEdit } from "@/lib/admin/last-edited";

describe("QuickCreate", () => {
  it("offers four one-click creates", () => {
    render(<QuickCreate />);
    const region = screen.getByRole("navigation", { name: "Tạo nhanh" });
    const links = within(region).getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/admin/projects/new",
      "/admin/experiences/new",
      "/admin/certificates/new",
      "/admin/skills/new",
    ]);
  });
});

describe("describeEdit", () => {
  const at = "2026-10-19T00:00:00Z";
  it("names the kind of item and links to its editor", () => {
    expect(
      describeEdit("projects", {
        id: "siteplus",
        title: "SitePlus",
        updated_at: at,
      }),
    ).toEqual({
      kind: "Dự án",
      label: "SitePlus",
      href: "/admin/projects/siteplus",
      at,
    });
    expect(
      describeEdit("activities", {
        id: "x",
        name: { en: "Hackathon" },
        updated_at: at,
      }).label,
    ).toBe("Hackathon");
  });

  it("covers the profile, roles and skill links", () => {
    expect(
      describeEdit("profile", { id: "me", name: "Cat", updated_at: at }),
    ).toMatchObject({ kind: "Hồ sơ", href: "/admin/profile" });
    expect(
      describeEdit("roles", { key: "fullstack", updated_at: at }),
    ).toMatchObject({ kind: "Vai trò", href: "/admin/roles" });
    expect(
      describeEdit("skill_links", {
        skill_id: "react",
        project_id: "siteplus",
        updated_at: at,
      }),
    ).toMatchObject({
      kind: "Liên kết kỹ năng",
      label: "react ↔ siteplus",
      href: "/admin/skills",
    });
  });
});
