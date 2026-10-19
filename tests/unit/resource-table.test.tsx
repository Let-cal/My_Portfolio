import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { listRows } from "@/lib/admin/list-view";

const push = vi.fn();
const refresh = vi.fn();
const duplicateResource = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/app/admin/actions", () => ({
  deleteResource: vi.fn(),
  reorderResource: vi.fn(),
  togglePublished: vi.fn(),
  duplicateResource,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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
});
