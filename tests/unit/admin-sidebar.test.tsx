import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/admin/projects/siteplus";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { AdminSidebar, NAV_GROUPS } = await import("@/components/admin/AdminSidebar");

beforeEach(() => {
  pathname = "/admin/projects/siteplus";
  localStorage.clear();
});

describe("AdminSidebar", () => {
  it("marks the section you are in", () => {
    render(<AdminSidebar />);
    const nav = screen.getAllByRole("navigation", { name: "Quản trị" })[0];
    expect(within(nav).getByRole("link", { name: /Dự án/ }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: /Tổng quan/ }).getAttribute("aria-current")).toBeNull();
  });

  it("marks Tổng quan only on the dashboard itself", () => {
    pathname = "/admin";
    render(<AdminSidebar />);
    const nav = screen.getAllByRole("navigation", { name: "Quản trị" })[0];
    expect(within(nav).getByRole("link", { name: /Tổng quan/ }).getAttribute("aria-current")).toBe("page");
  });

  it("groups the links", () => {
    expect(NAV_GROUPS.map((g) => g.title)).toEqual(["Tổng quan", "Nội dung", "Hồ sơ & vai trò"]);
    expect(NAV_GROUPS[1].items[0].label).toBe("Kỹ năng");
  });

  it("opens a drawer menu on small screens", () => {
    render(<AdminSidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Mở menu" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("link", { name: /Chứng chỉ/ })).toBeTruthy();
  });

  it("remembers a collapsed sidebar", () => {
    render(<AdminSidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Thu gọn menu" }));
    expect(localStorage.getItem("admin.sidebar")).toBe("collapsed");
    expect(screen.getByRole("button", { name: "Mở rộng menu" })).toBeTruthy();
  });
});
