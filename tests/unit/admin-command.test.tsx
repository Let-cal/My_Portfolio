import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { buildCommandItems } from "@/lib/admin/command-items";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function () {};

const { AdminCommand } = await import("@/components/admin/AdminCommand");
const { useUnsavedGuard } = await import("@/components/admin/SaveBar");
const content = contentSchema.parse(seed);

describe("buildCommandItems", () => {
  const items = buildCommandItems(content);

  it("lists every item with its type", () => {
    expect(items).toContainEqual(
      expect.objectContaining({
        group: "Nội dung",
        label: "Dự án · SitePlus",
        href: "/admin/projects/siteplus",
      }),
    );
    expect(items.filter((i) => i.label.startsWith("Kỹ năng · "))).toHaveLength(
      content.skills.length,
    );
  });

  it("offers screens, quick creates, the public site and the orphan filter", () => {
    const labels = items.map((i) => i.label);
    expect(labels).toContain("Tổng quan");
    expect(labels).toContain("Tạo chứng chỉ mới");
    expect(labels).toContain("Trang công khai (EN)");
    expect(
      items.find((i) => i.label === "Kỹ năng chưa có bằng chứng")?.href,
    ).toBe("/admin/skills?filter=orphan");
  });
});

describe("AdminCommand", () => {
  it("opens with Ctrl+K and goes to the chosen item", async () => {
    render(<AdminCommand items={buildCommandItems(content)} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () =>
      fireEvent.keyDown(document, { key: "k", ctrlKey: true }),
    );
    const input = screen.getByRole("combobox");
    await act(async () =>
      fireEvent.change(input, { target: { value: "sitep" } }),
    );
    await act(async () => fireEvent.keyDown(input, { key: "Enter" }));
    expect(push).toHaveBeenCalledWith("/admin/projects/siteplus");
  });

  it("opens from the search button", async () => {
    render(<AdminCommand items={[]} />);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Tìm/ })),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("asks before jumping away from unsaved edits", async () => {
    push.mockReset();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    function Dirty() {
      useUnsavedGuard(true);
      return null;
    }
    render(
      <>
        <Dirty />
        <AdminCommand items={buildCommandItems(content)} />
      </>,
    );
    await act(async () =>
      fireEvent.keyDown(document, { key: "k", ctrlKey: true }),
    );
    const input = screen.getByRole("combobox");
    await act(async () =>
      fireEvent.change(input, { target: { value: "sitep" } }),
    );
    await act(async () => fireEvent.keyDown(input, { key: "Enter" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
