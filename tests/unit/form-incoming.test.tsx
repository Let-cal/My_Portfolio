import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";

const saveResource = vi.fn();
const push = vi.fn();
vi.mock("@/app/admin/actions", () => ({
  saveResource,
  saveRole: vi.fn(),
  saveProfile: vi.fn(),
  setOpenToWork: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
}));
const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
);
vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabase: vi.fn() }));
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function () {};

const { ResourceForm } = await import("@/components/admin/ResourceForm");
const { ADMIN_DISCARD_EVENT } = await import("@/lib/admin/sync");
const content = contentSchema.parse(seed);
const { sortIndex: _s, ...cert } = content.certificates[0];
void _s;

beforeEach(() => {
  saveResource.mockReset().mockResolvedValue({ ok: true });
  push.mockReset();
  localStorage.clear();
});

const form = (initial: Record<string, unknown>) => (
  <ResourceForm
    resourceKey="certificates"
    isNew={false}
    initial={initial}
    options={{}}
  />
);
const nameInput = () =>
  document.getElementById("field-name") as HTMLInputElement;

describe("form and new server data", () => {
  it("takes new server data when nothing is edited", async () => {
    const { rerender } = render(form(cert));
    await act(async () =>
      rerender(form({ ...cert, name: "Tên mới từ server" })),
    );
    expect(nameInput().value).toBe("Tên mới từ server");
    expect(screen.queryByText(/Có bản mới hơn/)).toBeNull();
  });

  it("asks before replacing unsaved edits", async () => {
    const { rerender } = render(form(cert));
    await act(async () =>
      fireEvent.change(nameInput(), { target: { value: "Tôi đang sửa" } }),
    );
    await act(async () => rerender(form({ ...cert, name: "Bản từ tab khác" })));
    expect(nameInput().value).toBe("Tôi đang sửa");
    expect(screen.getByText(/Có bản mới hơn/)).toBeTruthy();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Giữ bản của tôi" })),
    );
    expect(nameInput().value).toBe("Tôi đang sửa");
    expect(screen.queryByText(/Có bản mới hơn/)).toBeNull();
  });

  it("reloads the server version on request", async () => {
    const { rerender } = render(form(cert));
    await act(async () =>
      fireEvent.change(nameInput(), { target: { value: "Tôi đang sửa" } }),
    );
    await act(async () => rerender(form({ ...cert, name: "Bản từ tab khác" })));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Tải lại" })),
    );
    expect(nameInput().value).toBe("Bản từ tab khác");
  });

  it("drops edits without asking after a restore from history", async () => {
    const { rerender } = render(form(cert));
    await act(async () =>
      fireEvent.change(nameInput(), { target: { value: "Tôi đang sửa" } }),
    );
    await act(async () =>
      window.dispatchEvent(
        new CustomEvent(ADMIN_DISCARD_EVENT, {
          detail: { table: "certificates", itemKey: String(cert.id) },
        }),
      ),
    );
    await act(async () =>
      rerender(form({ ...cert, name: "Bản đã khôi phục" })),
    );
    expect(nameInput().value).toBe("Bản đã khôi phục");
    expect(screen.queryByText(/Có bản mới hơn/)).toBeNull();
  });

  it("after creating, lands on the list at the new item with quick next steps", async () => {
    const { sortIndex: _x, ...fresh } = content.certificates[1];
    void _x;
    render(
      <ResourceForm
        resourceKey="certificates"
        isNew
        initial={{ ...fresh, id: "test-item", published: true }}
        options={{ existingIds: [] }}
      />,
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Lưu" })),
    );
    expect(push).toHaveBeenCalledWith(
      "/admin/certificates?highlight=test-item",
    );
    const [message, options] = toast.success.mock.calls.at(-1)!;
    expect(message).toContain("Đã tạo");
    render(<>{options.description}</>);
    expect(
      screen.getByRole("link", { name: "Mở lại" }).getAttribute("href"),
    ).toBe("/admin/certificates/test-item");
    expect(
      screen.getByRole("link", { name: "Tạo thêm" }).getAttribute("href"),
    ).toBe("/admin/certificates/new");
    expect(
      screen.getByRole("link", { name: /Xem trên trang/ }).getAttribute("href"),
    ).toMatch(/\/en#certificates$/);
  });

  it("offers an unsaved draft and restores it", async () => {
    localStorage.setItem(
      `admin.draft.certificates.${cert.id}`,
      JSON.stringify({
        // Only the edited field: restoring keeps every other field from the server.
        values: { name: "Nháp chưa lưu" },
        savedAt: new Date().toISOString(),
        baseSignature: "old",
      }),
    );
    render(form(cert));
    expect(screen.getByText(/Có bản nháp chưa lưu/)).toBeTruthy();
    expect(screen.getByText(/dữ liệu đã thay đổi kể từ bản nháp/)).toBeTruthy();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Khôi phục" })),
    );
    expect(nameInput().value).toBe("Nháp chưa lưu");
    expect(
      (document.getElementById("field-organization") as HTMLInputElement).value,
    ).toBe(cert.organization);
    expect(screen.queryByText(/Có bản nháp chưa lưu/)).toBeNull();
  });

  it("forgets the draft after a successful save", async () => {
    const key = `admin.draft.certificates.${cert.id}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        values: { name: "Nháp" },
        savedAt: new Date().toISOString(),
        baseSignature: "x",
      }),
    );
    render(form(cert));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Khôi phục" })),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Lưu" })),
    );
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("keeps unsaved edits when the item is deleted elsewhere and offers a way out", async () => {
    const { publishChange } = await import("@/lib/admin/own-writes");
    render(form(cert));
    await act(async () =>
      fireEvent.change(nameInput(), { target: { value: "Tôi đang sửa" } }),
    );
    await act(async () =>
      publishChange({
        table: "certificates",
        op: "delete",
        key: String(cert.id),
      }),
    );
    expect(screen.getByText(/Mục này đã bị xóa ở nơi khác/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Khôi phục rồi lưu bản của tôi" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Lưu thành mục mới" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Về danh sách" })).toBeTruthy();
    expect(nameInput().value).toBe("Tôi đang sửa");
  });

  it("goes back to the list when an untouched item is deleted elsewhere", async () => {
    const { publishChange } = await import("@/lib/admin/own-writes");
    render(form(cert));
    await act(async () =>
      publishChange({
        table: "certificates",
        op: "delete",
        key: String(cert.id),
      }),
    );
    expect(push).toHaveBeenCalledWith("/admin/certificates");
  });

  it("a restore elsewhere on the page leaves other forms' edits alone", async () => {
    render(form(cert));
    await act(async () =>
      fireEvent.change(nameInput(), { target: { value: "Tôi đang sửa" } }),
    );
    await act(async () =>
      window.dispatchEvent(
        new CustomEvent(ADMIN_DISCARD_EVENT, {
          detail: { table: "roles", itemKey: "pm" },
        }),
      ),
    );
    // Still marked unsaved: the guard, save bar and autosave keep protecting these edits.
    expect(screen.getByText("Có thay đổi chưa lưu")).toBeTruthy();
  });

  it("a restore of this item shows the server version even when nothing changed on the server", async () => {
    render(form(cert));
    await act(async () =>
      fireEvent.change(nameInput(), { target: { value: "Tôi đang sửa" } }),
    );
    await act(async () =>
      window.dispatchEvent(
        new CustomEvent(ADMIN_DISCARD_EVENT, {
          detail: { table: "certificates", itemKey: String(cert.id) },
        }),
      ),
    );
    expect(nameInput().value).toBe(cert.name);
  });

  it("says so when the account may not save", async () => {
    saveResource.mockResolvedValue({
      ok: false,
      error: "Tài khoản này không có quyền quản trị.",
      code: "FORBIDDEN",
    });
    render(form(cert));
    await act(async () =>
      fireEvent.change(nameInput(), { target: { value: "X" } }),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Lưu" })),
    );
    expect(toast.error).toHaveBeenCalledWith(
      "Tài khoản này không có quyền quản trị.",
    );
  });

  it("lets go of a held refresh when the form closes", async () => {
    const { publishChange, isRefreshHeld } =
      await import("@/lib/admin/own-writes");
    const view = render(form(cert));
    await act(async () =>
      fireEvent.change(nameInput(), { target: { value: "Tôi đang sửa" } }),
    );
    await act(async () =>
      publishChange({
        table: "certificates",
        op: "delete",
        key: String(cert.id),
      }),
    );
    expect(isRefreshHeld(window.location.pathname)).toBe(true);
    view.unmount();
    expect(isRefreshHeld(window.location.pathname)).toBe(false);
  });
});
