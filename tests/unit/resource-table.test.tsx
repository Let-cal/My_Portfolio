import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { listRows } from "@/lib/admin/list-view";

const push = vi.fn();
const refresh = vi.fn();
const duplicateResource = vi.fn();
const deleteResource = vi.fn();
const togglePublished = vi.fn();
const undoDelete = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/app/admin/actions", () => ({
  deleteResource,
  undoDelete,
  reorderResource: vi.fn(),
  togglePublished,
  duplicateResource,
}));
vi.mock("sonner", () => ({ toast }));

const { ResourceTable } = await import("@/components/admin/ResourceTable");
const content = contentSchema.parse(seed);

beforeEach(() => {
  push.mockReset();
  duplicateResource.mockReset();
});

describe("ResourceTable", () => {
  it("shows each item with a readable detail line", () => {
    render(
      <ResourceTable
        resourceKey="experiences"
        initialRows={listRows("experiences", content)}
      />,
    );
    const row = screen
      .getByText("COA (Certificate of Analysis system)")
      .closest("li")!;
    expect(within(row).getByText(/ – /)).toBeTruthy();
  });

  it("filters by search text and by status chip", async () => {
    const rows = listRows("projects", content);
    rows[0] = { ...rows[0], hidden: true };
    render(<ResourceTable resourceKey="projects" initialRows={rows} />);
    const list = () => screen.getAllByRole("listitem");
    expect(list()).toHaveLength(rows.length);

    await act(async () =>
      fireEvent.change(screen.getByRole("searchbox", { name: /Tìm/ }), {
        target: { value: "siteplus" },
      }),
    );
    expect(list()).toHaveLength(1);

    await act(async () =>
      fireEvent.change(screen.getByRole("searchbox", { name: /Tìm/ }), {
        target: { value: "" },
      }),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Đang ẩn/ })),
    );
    expect(
      screen
        .getByRole("button", { name: /Đang ẩn/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(list()).toHaveLength(1);
  });

  it("says when nothing matches", async () => {
    render(
      <ResourceTable
        resourceKey="certificates"
        initialRows={listRows("certificates", content)}
      />,
    );
    await act(async () =>
      fireEvent.change(screen.getByRole("searchbox", { name: /Tìm/ }), {
        target: { value: "zzzz" },
      }),
    );
    expect(screen.getByText(/Không có mục nào khớp/)).toBeTruthy();
  });

  it("duplicates an item and opens the copy", async () => {
    duplicateResource.mockResolvedValue({ ok: true, id: "ielts-copy" });
    const rows = listRows("certificates", content);
    render(<ResourceTable resourceKey="certificates" initialRows={rows} />);
    await act(async () =>
      fireEvent.click(screen.getAllByRole("button", { name: /Nhân bản/ })[0]),
    );
    expect(duplicateResource).toHaveBeenCalledWith("certificates", rows[0].id);
    expect(push).toHaveBeenCalledWith("/admin/certificates/ielts-copy");
  });

  it("copies a skill into the new-item form instead of publishing a copy", async () => {
    const rows = listRows("skills", content);
    render(<ResourceTable resourceKey="skills" initialRows={rows} />);
    await act(async () =>
      fireEvent.click(screen.getAllByRole("button", { name: /Nhân bản/ })[0]),
    );
    expect(duplicateResource).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(`/admin/skills/new?from=${rows[0].id}`);
  });

  it("lists what a delete affects before confirming", async () => {
    const rows = listRows("experiences", content);
    render(
      <ResourceTable
        resourceKey="experiences"
        initialRows={rows}
        impacts={{ [rows[0].id]: ["Mất 3 liên kết kỹ năng"] }}
      />,
    );
    await act(async () =>
      fireEvent.click(screen.getAllByRole("button", { name: /^Xóa / })[0]),
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Mất 3 liên kết kỹ năng")).toBeTruthy();
  });

  it("offers Hoàn tác for 10 seconds after a delete", async () => {
    deleteResource.mockResolvedValue({ ok: true });
    undoDelete.mockResolvedValue({ ok: true });
    const rows = listRows("certificates", content);
    render(<ResourceTable resourceKey="certificates" initialRows={rows} />);
    await act(async () =>
      fireEvent.click(screen.getAllByRole("button", { name: /^Xóa / })[0]),
    );
    await act(async () =>
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Xóa" }),
      ),
    );
    const [message, options] = toast.success.mock.calls.at(-1)!;
    expect(message).toContain("Đã xóa");
    expect(options).toMatchObject({
      duration: 10000,
      action: { label: "Hoàn tác" },
    });
    expect(screen.queryByText(rows[0].label)).toBeNull();
    await act(async () => options.action.onClick());
    expect(undoDelete).toHaveBeenCalledWith("certificates", rows[0].id);
    // The restored item is back in the list at once, without waiting for a reload.
    expect(screen.getByText(rows[0].label)).toBeTruthy();
  });

  it("shows rows that arrive from the server", () => {
    const rows = listRows("certificates", content);
    const { rerender } = render(
      <ResourceTable resourceKey="certificates" initialRows={rows.slice(1)} />,
    );
    expect(screen.queryByText(rows[0].label)).toBeNull();
    rerender(<ResourceTable resourceKey="certificates" initialRows={rows} />);
    expect(screen.getByText(rows[0].label)).toBeTruthy();
  });

  it("keeps a toggle that is still saving when server data arrives", async () => {
    let finish: (v: { ok: true }) => void = () => {};
    togglePublished.mockReturnValue(new Promise((r) => (finish = r)));
    const rows = listRows("certificates", content);
    const { rerender } = render(
      <ResourceTable resourceKey="certificates" initialRows={rows} />,
    );
    const toggle = screen.getByRole("switch", {
      name: `Hiển thị ${rows[0].label}`,
    });
    await act(async () => fireEvent.click(toggle));
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    // Unrelated server data arrives (an extra row) while the toggle is saving.
    const extra = { ...rows[0], id: "new-one", label: "New one" };
    rerender(
      <ResourceTable
        resourceKey="certificates"
        initialRows={[...rows, extra]}
      />,
    );
    expect(screen.getByText("New one")).toBeTruthy();
    expect(
      screen
        .getByRole("switch", { name: `Hiển thị ${rows[0].label}` })
        .getAttribute("aria-checked"),
    ).toBe("false");
    await act(async () => finish({ ok: true }));
  });
});
