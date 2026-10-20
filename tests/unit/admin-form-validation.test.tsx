import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
const { emptyItem } = await import("@/lib/admin/empty-item");

const renderNewCertificate = () =>
  render(
    <ResourceForm
      resourceKey="certificates"
      isNew
      initial={emptyItem("certificates")}
      options={{}}
    />,
  );
const save = () =>
  act(async () => fireEvent.click(screen.getByRole("button", { name: "Lưu" })));
const summary = () => screen.queryByRole("region", { name: /mục cần sửa/ });

beforeEach(() => saveResource.mockReset().mockResolvedValue({ ok: true }));

describe("form validation", () => {
  it("marks required fields", () => {
    renderNewCertificate();
    expect(screen.getByText("Mục có * là bắt buộc")).toBeTruthy();
    expect(
      screen.getByText("Tên chứng chỉ").closest("label")!.textContent,
    ).toContain("*");
    expect(
      screen.getByText("Link xác minh").closest("label")!.textContent,
    ).not.toContain("*");
  });

  it("lists every problem in a focused summary instead of saving", async () => {
    renderNewCertificate();
    await save();
    const box = summary()!;
    expect(box).toBeTruthy();
    expect(within(box).getByText("Có 5 mục cần sửa")).toBeTruthy();
    expect(
      within(box)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual([
      "Nhập ID",
      "Nhập tên chứng chỉ",
      "Nhập tổ chức cấp",
      "Chọn ngày cấp",
      "Nhập mô tả (EN)",
    ]);
    expect(document.activeElement).toBe(box);
    expect(saveResource).not.toHaveBeenCalled();
  });

  it("puts each error under its own input and links it for screen readers", async () => {
    renderNewCertificate();
    await save();
    const name = document.getElementById("field-name")!;
    expect(name.getAttribute("aria-invalid")).toBe("true");
    const describedBy = name.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)!.textContent).toBe(
      "Lỗi: Nhập tên chứng chỉ",
    );
    const en = document.getElementById("field-description.en")!;
    expect(en.getAttribute("aria-invalid")).toBe("true");
  });

  it("jumps to the field from the summary", async () => {
    renderNewCertificate();
    await save();
    fireEvent.click(
      within(summary()!).getByRole("link", { name: "Nhập tên chứng chỉ" }),
    );
    expect(document.activeElement).toBe(document.getElementById("field-name"));
  });

  it("clears a fixed field from the summary at once", async () => {
    renderNewCertificate();
    await save();
    await act(async () =>
      fireEvent.change(document.getElementById("field-name")!, {
        target: { value: "IELTS" },
      }),
    );
    // The name also fills the ID of a new item, so both lines go.
    expect(within(summary()!).getByText("Có 3 mục cần sửa")).toBeTruthy();
    expect(
      within(summary()!).queryByRole("link", { name: "Nhập ID" }),
    ).toBeNull();
    expect(
      document.getElementById("field-name")!.getAttribute("aria-invalid"),
    ).toBe("false");
  });

  it("shows server errors on the field they belong to", async () => {
    saveResource.mockResolvedValue({
      ok: false,
      error: "ID đã được dùng",
      fieldErrors: { id: 'ID "ielts" đã được dùng, chọn ID khác' },
    });
    render(
      <ResourceForm
        resourceKey="certificates"
        isNew
        initial={{
          ...emptyItem("certificates"),
          id: "ielts",
          name: "IELTS",
          organization: "IDP",
          issueDate: "2026-09-30",
          description: { en: "Band 7.0", ja: "", vi: "" },
        }}
        options={{}}
      />,
    );
    await save();
    expect(saveResource).toHaveBeenCalledTimes(1);
    expect(
      within(summary()!).getByRole("link", {
        name: 'ID "ielts" đã được dùng, chọn ID khác',
      }),
    ).toBeTruthy();
    expect(
      document.getElementById("field-id")!.getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("explains that JA and VI may stay empty", () => {
    renderNewCertificate();
    expect(screen.getAllByText(/JA, VI không bắt buộc/).length).toBeGreaterThan(
      0,
    );
  });
});
