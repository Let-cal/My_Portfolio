import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listVersions = vi.fn();
const restoreVersion = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("@/app/admin/actions", () => ({ listVersions, restoreVersion }));
vi.mock("sonner", () => ({ toast }));

const { VersionHistory } = await import("@/components/admin/VersionHistory");
const reload = vi.fn();
const discarded = vi.fn();
window.addEventListener("admin:discard-edits", discarded);

beforeEach(() => {
  listVersions.mockReset();
  restoreVersion.mockReset().mockResolvedValue({ ok: true });
  reload.mockReset();
  discarded.mockReset();
  Object.defineProperty(window, "location", {
    value: { ...window.location, reload },
    configurable: true,
  });
});

const versions = [
  {
    id: 9,
    op: "update",
    oldRow: { id: "x", name: "Tên cũ" },
    changedBy: "a@b.c",
    changedAt: new Date().toISOString(),
  },
  {
    id: 4,
    op: "update",
    oldRow: { id: "x", name: "Tên đầu" },
    changedBy: "a@b.c",
    changedAt: new Date().toISOString(),
  },
];

async function open() {
  render(<VersionHistory table="certificates" itemKey="x" />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: /Lịch sử/ })),
  );
}

describe("VersionHistory", () => {
  it("shows versions and the fields that changed", async () => {
    listVersions.mockResolvedValue({
      ok: true,
      versions,
      current: { id: "x", name: "Tên mới" },
    });
    await open();
    expect(listVersions).toHaveBeenCalledWith("certificates", "x");
    const sheet = screen.getByRole("dialog", { name: "Lịch sử thay đổi" });
    expect(within(sheet).getAllByRole("button", { name: /Sửa/ })).toHaveLength(
      2,
    );
    await act(async () =>
      fireEvent.click(within(sheet).getAllByRole("button", { name: /Sửa/ })[0]),
    );
    const row = within(sheet).getByRole("row", { name: /name/ });
    expect(within(row).getByText("Tên cũ")).toBeTruthy();
    expect(within(row).getByText("Tên mới")).toBeTruthy();
  });

  it("restores the chosen version", async () => {
    listVersions.mockResolvedValue({
      ok: true,
      versions,
      current: { id: "x", name: "Tên mới" },
    });
    await open();
    const sheet = screen.getByRole("dialog", { name: "Lịch sử thay đổi" });
    await act(async () =>
      fireEvent.click(within(sheet).getAllByRole("button", { name: /Sửa/ })[1]),
    );
    await act(async () =>
      fireEvent.click(
        within(sheet).getByRole("button", { name: "Khôi phục bản này" }),
      ),
    );
    expect(restoreVersion).toHaveBeenCalledWith(4);
    // No full reload: open forms drop their edits and the server refresh brings the restored data.
    expect(reload).not.toHaveBeenCalled();
    expect(discarded).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Đã khôi phục phiên bản");
  });

  it("explains an empty history", async () => {
    listVersions.mockResolvedValue({
      ok: true,
      versions: [],
      current: { id: "x" },
    });
    await open();
    expect(screen.getByText(/Chưa có phiên bản nào/)).toBeTruthy();
  });

  it("shows a load error", async () => {
    listVersions.mockResolvedValue({ ok: false, error: "not allowed" });
    await open();
    expect(screen.getByRole("alert").textContent).toContain("not allowed");
  });
});
