import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ list: vi.fn(), client: vi.fn() }));
vi.mock("@/app/admin/media-actions", () => ({
  listMedia: m.list,
  deleteMedia: vi.fn(),
}));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabase: m.client }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { UploadField } from "@/components/admin/UploadField";
beforeEach(() => {
  vi.clearAllMocks();
  m.list.mockResolvedValue({
    ok: true,
    library: {
      knownBytes: 50,
      unknownSizes: 0,
      files: [
        {
          bucket: "media",
          name: "pond.png",
          path: "pond.png",
          url: "https://project.supabase.co/storage/v1/object/public/media/pond.png",
          kind: "image",
          mime: "image/png",
          size: 50,
          createdAt: null,
          uses: [],
        },
      ],
    },
  });
});
afterEach(cleanup);
it("does not load the library until open and choosing only changes the form URL", async () => {
  const change = vi.fn(),
    user = userEvent.setup();
  render(
    <UploadField
      id="poster"
      label="Poster"
      kind="image"
      value={null}
      onChange={change}
    />,
  );
  expect(m.list).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Chọn từ thư viện" }));
  await screen.findByRole("button", { name: "Chọn pond.png" });
  await user.click(screen.getByRole("button", { name: "Chọn pond.png" }));
  expect(change).toHaveBeenCalledWith(
    "https://project.supabase.co/storage/v1/object/public/media/pond.png",
  );
  expect(m.client).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("cancelling preserves the existing file and returns focus to its trigger", async () => {
  const change = vi.fn(),
    user = userEvent.setup();
  render(
    <UploadField
      id="poster"
      label="Poster"
      kind="image"
      value="https://example.test/old.png"
      onChange={change}
    />,
  );
  const trigger = screen.getByRole("button", { name: "Chọn từ thư viện" });
  await user.click(trigger);
  await screen.findByText("pond.png");
  await user.keyboard("{Escape}");
  expect(change).not.toHaveBeenCalled();
  expect(trigger).toHaveFocus();
});
