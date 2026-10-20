import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";

const saveResource = vi.fn();
vi.mock("@/app/admin/actions", () => ({ saveResource }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabase: vi.fn() }));
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function () {};

const { ResourceForm } = await import("@/components/admin/ResourceForm");
const project = {
  ...contentSchema.parse(seed).projects[0],
  skillIds: [] as string[],
};
const renderProject = () =>
  render(
    <ResourceForm
      resourceKey="projects"
      isNew={false}
      initial={project}
      options={{}}
    />,
  );
const bar = () => screen.getByRole("region", { name: "Lưu thay đổi" });
const leaving = () => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

beforeEach(() => saveResource.mockReset().mockResolvedValue({ ok: true }));

describe("save bar", () => {
  it("says when there are unsaved changes", () => {
    renderProject();
    expect(within(bar()).queryByText("Có thay đổi chưa lưu")).toBeNull();
    fireEvent.change(document.getElementById("field-title")!, {
      target: { value: "SitePlus 2" },
    });
    expect(within(bar()).getByText("Có thay đổi chưa lưu")).toBeTruthy();
  });

  it("saves with Ctrl+S", async () => {
    renderProject();
    fireEvent.change(document.getElementById("field-title")!, {
      target: { value: "SitePlus 2" },
    });
    await act(async () =>
      fireEvent.keyDown(window, { key: "s", ctrlKey: true }),
    );
    expect(saveResource).toHaveBeenCalledTimes(1);
    expect(saveResource.mock.calls[0][1].title).toBe("SitePlus 2");
  });

  it("asks before leaving with unsaved changes, and not after saving", async () => {
    renderProject();
    expect(leaving()).toBe(false);
    fireEvent.change(document.getElementById("field-title")!, {
      target: { value: "SitePlus 2" },
    });
    expect(leaving()).toBe(true);
    await act(async () =>
      fireEvent.click(within(bar()).getByRole("button", { name: "Lưu" })),
    );
    expect(leaving()).toBe(false);
  });

  it("counts errors and jumps to them", async () => {
    renderProject();
    fireEvent.change(document.getElementById("field-title")!, {
      target: { value: "" },
    });
    await act(async () =>
      fireEvent.click(within(bar()).getByRole("button", { name: "Lưu" })),
    );
    expect(
      within(bar()).getByRole("button", { name: "1 lỗi · Xem" }),
    ).toBeTruthy();
  });
});

describe("form sections", () => {
  it("groups a project form into named sections, in order", () => {
    renderProject();
    const nav = screen.getByRole("navigation", { name: "Các mục của form" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual([
      "Thông tin",
      "Nội dung",
      "Case study",
      "Liên kết & skills",
      "Hiển thị",
    ]);
    expect(screen.getByRole("heading", { name: "Case study" })).toBeTruthy();
  });

  it("shows how many errors each section has", async () => {
    renderProject();
    fireEvent.change(document.getElementById("field-title")!, {
      target: { value: "" },
    });
    await act(async () =>
      fireEvent.click(within(bar()).getByRole("button", { name: "Lưu" })),
    );
    const nav = screen.getByRole("navigation", { name: "Các mục của form" });
    expect(
      within(nav).getByRole("link", { name: /Thông tin/ }).textContent,
    ).toContain("1");
  });
});
