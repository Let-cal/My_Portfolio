import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";

const saveSkillLinks = vi.fn();
const saveResource = vi.fn();
const refresh = vi.fn();
const toast = { error: vi.fn(), success: vi.fn() };
vi.mock("@/app/admin/actions", () => ({ saveSkillLinks, saveResource }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh }),
  usePathname: () => "/admin/skills",
}));
vi.mock("sonner", () => ({ toast }));

const { SkillMatrix } = await import("@/components/admin/SkillMatrix");
const content = contentSchema.parse(seed);
const all = {
  q: "",
  only: "all" as const,
  group: "all" as const,
  showHidden: true,
};
/** One matrix cell. A direct attribute lookup: role queries over ~400 cells are slow in jsdom. */
const cell = (skill: string, column: string) => {
  const el = document.querySelector<HTMLElement>(
    `button[role="checkbox"][aria-label="${skill} × ${column}"]`,
  );
  if (!el) throw new Error(`No cell ${skill} × ${column}`);
  return el;
};
const saveButton = () => screen.queryByRole("button", { name: /^Lưu/ });

beforeEach(() => {
  saveSkillLinks.mockReset().mockResolvedValue({ ok: true });
  saveResource.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
  toast.error.mockReset();
});

describe("SkillMatrix (edit, then save)", () => {
  it("marks a change without saving it", () => {
    render(<SkillMatrix content={content} initialFilter={all} />);
    expect(saveButton()).toBeNull();
    const target = cell("C#", "SitePlus");
    fireEvent.click(target);
    expect(target.getAttribute("aria-checked")).toBe("true");
    expect(target.getAttribute("data-changed")).toBe("true");
    expect(saveSkillLinks).not.toHaveBeenCalled();
    expect(screen.getByText("1 thay đổi chưa lưu")).toBeTruthy();
  });

  it("clicking a cell back to its saved state is no longer a change", () => {
    render(<SkillMatrix content={content} initialFilter={all} />);
    const target = cell("C#", "SitePlus");
    fireEvent.click(target);
    fireEvent.click(target);
    expect(saveButton()).toBeNull();
  });

  it("saves every change in one request", async () => {
    render(<SkillMatrix content={content} initialFilter={all} />);
    fireEvent.click(cell("C#", "SitePlus"));
    fireEvent.click(cell("TypeScript", "AI Agent"));
    await act(async () => fireEvent.click(saveButton()!));
    expect(saveSkillLinks).toHaveBeenCalledTimes(1);
    expect(saveSkillLinks.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        { skillId: "csharp", projectId: "siteplus", linked: true },
        { skillId: "typescript", projectId: "skg-ai-agent", linked: false },
      ]),
    );
    expect(saveButton()).toBeNull();
    // The server action refreshes the screens (tested in admin-actions); no extra client refresh.
    expect(refresh).not.toHaveBeenCalled();
  });

  it("Ctrl+S saves", async () => {
    render(<SkillMatrix content={content} initialFilter={all} />);
    fireEvent.click(cell("C#", "SitePlus"));
    await act(async () =>
      fireEvent.keyDown(window, { key: "s", ctrlKey: true }),
    );
    expect(saveSkillLinks).toHaveBeenCalledTimes(1);
  });

  it("Hủy discards the changes", () => {
    render(<SkillMatrix content={content} initialFilter={all} />);
    const target = cell("C#", "SitePlus");
    fireEvent.click(target);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(target.getAttribute("aria-checked")).toBe("false");
    expect(saveButton()).toBeNull();
  });

  it("keeps the changes and reports the error when saving fails", async () => {
    saveSkillLinks.mockResolvedValue({ ok: false, error: "nope" });
    render(<SkillMatrix content={content} initialFilter={all} />);
    const target = cell("C#", "SitePlus");
    fireEvent.click(target);
    await act(async () => fireEvent.click(saveButton()!));
    expect(target.getAttribute("aria-checked")).toBe("true");
    expect(saveButton()).not.toBeNull();
    expect(toast.error).toHaveBeenCalled();
  });

  it("keeps a skill in the 'no evidence' list while editing and after saving", async () => {
    const orphan = { ...all, only: "orphan" as const };
    const { rerender } = render(
      <SkillMatrix content={content} initialFilter={orphan} />,
    );
    fireEvent.click(cell("GSAP", "SitePlus"));
    expect(cell("GSAP", "SitePlus")).toBeTruthy();
    await act(async () => fireEvent.click(saveButton()!));
    // The refresh brings content where GSAP has evidence; the row stays until the filter changes.
    const updated = structuredClone(content);
    updated.skills.find((s) => s.name === "GSAP")!.projectIds.push("siteplus");
    rerender(<SkillMatrix content={updated} initialFilter={orphan} />);
    expect(cell("GSAP", "SitePlus").getAttribute("aria-checked")).toBe("true");
  });

  it("moves with arrow keys and toggles with Space", () => {
    render(<SkillMatrix content={content} initialFilter={all} />);
    const first = cell("TypeScript", "AI Agent");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const next = document.activeElement as HTMLElement;
    expect(next).not.toBe(first);
    expect(next.getAttribute("role")).toBe("checkbox");
    const before = next.getAttribute("aria-checked");
    fireEvent.keyDown(next, { key: " " });
    expect(next.getAttribute("aria-checked")).not.toBe(before);
  });

  it("warns before leaving with unsaved changes", () => {
    render(<SkillMatrix content={content} initialFilter={all} />);
    fireEvent.click(cell("C#", "SitePlus"));
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe("SkillMatrix (add skills, headers)", () => {
  it("adds a skill to a group from the matrix", async () => {
    render(<SkillMatrix content={content} initialFilter={all} />);
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Thêm skill vào nhóm ai" }),
      ),
    );
    const input = screen.getByRole("textbox", { name: "Tên skill mới (ai)" });
    await act(async () =>
      fireEvent.change(input, { target: { value: "LangGraph" } }),
    );
    await act(async () => fireEvent.keyDown(input, { key: "Enter" }));
    expect(saveResource).toHaveBeenCalledWith(
      "skills",
      {
        id: "langgraph",
        name: "LangGraph",
        group: "ai",
        experienceIds: [],
        projectIds: [],
      },
      true,
    );
    // Ready for the next one: the row stays open, empty and focused.
    const again = screen.getByRole("textbox", {
      name: "Tên skill mới (ai)",
    }) as HTMLInputElement;
    expect(again.value).toBe("");
    expect(document.activeElement).toBe(again);
  });

  it("shows why a new skill was not added", async () => {
    saveResource.mockResolvedValue({
      ok: false,
      error: "ID đã được dùng",
      fieldErrors: { id: 'ID "react" đã được dùng, chọn ID khác' },
    });
    render(<SkillMatrix content={content} initialFilter={all} />);
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Thêm skill vào nhóm frameworks" }),
      ),
    );
    const input = screen.getByRole("textbox", {
      name: "Tên skill mới (frameworks)",
    });
    await act(async () =>
      fireEvent.change(input, { target: { value: "React" } }),
    );
    await act(async () => fireEvent.keyDown(input, { key: "Enter" }));
    expect(screen.getByText(/ID "react" đã được dùng/)).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(input);
  });

  it("gives every column header its full name as a tooltip", () => {
    render(<SkillMatrix content={content} initialFilter={all} />);
    const headers = screen
      .getAllByRole("columnheader")
      .filter((h) => h.querySelector("a"));
    expect(headers.length).toBeGreaterThan(0);
    for (const h of headers)
      expect(h.querySelector("a")!.getAttribute("title")).toBeTruthy();
  });

  it("asks before an in-app link drops unsaved matrix changes", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<SkillMatrix content={content} initialFilter={all} />);
    fireEvent.click(cell("C#", "SitePlus"));
    const link = screen.getByRole("link", { name: "C#" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    confirm.mockRestore();
  });

  it("left-aligns each slanted column name so it starts at its own column", () => {
    render(<SkillMatrix content={content} initialFilter={all} />);
    const label = screen
      .getAllByRole("columnheader")
      .find((h) => h.querySelector("a"))!
      .querySelector("a")!.parentElement!;
    expect(label.className).toContain("text-left");
    expect(label.className).toContain("-rotate-45");
  });

  it("highlights the row and column of the hovered cell", () => {
    render(<SkillMatrix content={content} initialFilter={all} />);
    const target = cell("C#", "SitePlus");
    fireEvent.mouseEnter(target);
    const header = screen
      .getByRole("link", { name: "SitePlus" })
      .closest("th")!;
    expect(header.getAttribute("data-active")).toBe("true");
    expect(
      screen.getByRole("rowheader", { name: "C#" }).getAttribute("data-active"),
    ).toBe("true");
    fireEvent.mouseLeave(screen.getByRole("grid"));
    expect(header.getAttribute("data-active")).toBeNull();
  });
});
