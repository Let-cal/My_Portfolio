import {
  render,
  screen,
  within,
  waitFor,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import type { MediaFile } from "@/lib/admin/media";
const m = vi.hoisted(() => ({
  list: vi.fn(),
  remove: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/app/admin/media-actions", () => ({
  listMedia: m.list,
  deleteMedia: m.remove,
}));
vi.mock("sonner", () => ({ toast: { success: m.success, error: m.error } }));
import { MediaBrowser } from "@/components/admin/MediaBrowser";
const file = (name: string, override: Partial<MediaFile> = {}): MediaFile => ({
  bucket: "media",
  path: name,
  name,
  url: `https://project.supabase.co/storage/v1/object/public/media/${name}`,
  kind: "image",
  mime: "image/png",
  size: 50,
  createdAt: "2026-10-20T10:00:00Z",
  uses: [],
  ...override,
});
const files = [
  file("pond.png"),
  file("used.png", { uses: [{ label: "Hồ sơ", href: "/admin/profile" }] }),
  file("cv.pdf", { bucket: "files", kind: "pdf", mime: "application/pdf" }),
  file("unknown.png", { size: null }),
  file("large.png", { size: 6 * 1024 * 1024 }),
];
beforeEach(() => {
  vi.clearAllMocks();
  m.list.mockResolvedValue({
    ok: true,
    library: { files, knownBytes: 6291606, unknownSizes: 1 },
  });
  m.remove.mockResolvedValue({ ok: true });
});
afterEach(cleanup);
it("loads, shows scoped usage and filters by filename, type and unused status", async () => {
  const user = userEvent.setup();
  render(<MediaBrowser />);
  expect(screen.getByRole("status").textContent).toContain("Đang tải");
  await screen.findByText("pond.png");
  expect(screen.getByText(/Chỉ tính hai bucket/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Hồ sơ" }).getAttribute("href")).toBe(
    "/admin/profile",
  );
  await user.selectOptions(screen.getByLabelText("Loại tệp"), "pdf");
  expect(screen.queryByText("pond.png")).toBeNull();
  expect(screen.getByText("cv.pdf")).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("Loại tệp"), "all");
  await user.click(screen.getByLabelText("Chỉ tệp chưa dùng"));
  expect(screen.queryByText("used.png")).toBeNull();
  await user.type(screen.getByRole("searchbox"), "pond");
  expect(screen.getByText("pond.png")).toBeTruthy();
  expect(screen.queryByText("cv.pdf")).toBeNull();
});
it("shows errors instead of a fake empty list and offers retry", async () => {
  m.list.mockResolvedValueOnce({ ok: false, error: "Storage không đọc được" });
  const user = userEvent.setup();
  render(<MediaBrowser />);
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    expect.stringContaining("Storage không đọc được"),
  );
  expect(screen.queryByText("Chưa có tệp trong thư viện.")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Thử lại" }));
  await screen.findByText("pond.png");
});
it("requires irreversible delete confirmation, guards pending and never offers deleting used files", async () => {
  const user = userEvent.setup();
  let finish!: (v: { ok: true }) => void;
  m.remove.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<MediaBrowser />);
  await screen.findByText("pond.png");
  expect(screen.queryByRole("button", { name: "Xóa used.png" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Xóa pond.png" }));
  expect(m.remove).not.toHaveBeenCalled();
  const dialog = screen.getByRole("dialog", { name: "Xóa tệp vĩnh viễn?" });
  await user.click(
    within(dialog).getByRole("button", { name: "Xóa vĩnh viễn" }),
  );
  expect(
    within(dialog).getByRole("button", { name: "Đang xóa…" }),
  ).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeDisabled();
  finish({ ok: true });
  await waitFor(() => expect(m.success).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByRole("searchbox")).toHaveFocus());
  expect(m.remove).toHaveBeenCalledTimes(1);
  expect(m.remove).toHaveBeenCalledWith("media", "pond.png");
});
it("keeps a deletion failure visible and does not claim success", async () => {
  m.remove.mockResolvedValue({ ok: false, error: "Tệp đang được dùng." });
  const user = userEvent.setup();
  render(<MediaBrowser />);
  await screen.findByText("pond.png");
  await user.click(screen.getByRole("button", { name: "Xóa pond.png" }));
  await user.click(screen.getByRole("button", { name: "Xóa vĩnh viễn" }));
  expect(await screen.findByText("Tệp đang được dùng.")).toBeTruthy();
  expect(m.success).not.toHaveBeenCalled();
});
it("returns keyboard focus to the delete button when cancelled and keeps confirmation scrollable", async () => {
  const user = userEvent.setup();
  render(<MediaBrowser />);
  await screen.findByText("pond.png");
  const trigger = screen.getByRole("button", { name: "Xóa pond.png" });
  await user.click(trigger);
  expect(screen.getByRole("dialog").className).toContain("overflow-y-auto");
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
});
it("picker restricts kind, known size and original upload limits; selection only returns the URL", async () => {
  const choose = vi.fn(),
    user = userEvent.setup();
  render(<MediaBrowser kind="image" onSelect={choose} />);
  await screen.findByText("pond.png");
  expect(screen.queryByText("cv.pdf")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Chọn unknown.png" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "Chọn large.png" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Xóa pond.png" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Chọn pond.png" }));
  expect(choose).toHaveBeenCalledWith(files[0].url);
  expect(m.remove).not.toHaveBeenCalled();
});
