import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";

const setSkillLink = vi.fn();
const flushContent = vi.fn();
const replace = vi.fn();
vi.mock("@/app/admin/actions", () => ({ setSkillLink, flushContent }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
  usePathname: () => "/admin/skills",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { SkillMatrix } = await import("@/components/admin/SkillMatrix");
const content = contentSchema.parse(seed);
const filter = { q: "", only: "all" as const, group: "all" as const, showHidden: true };

const cell = (skill: string, column: string) =>
  screen.getByRole("checkbox", { name: `${skill} × ${column}` });

beforeEach(() => {
  vi.useFakeTimers();
  setSkillLink.mockReset().mockResolvedValue({ ok: true });
  flushContent.mockReset().mockResolvedValue({ ok: true });
});
afterEach(() => vi.useRealTimers());

describe("SkillMatrix", () => {
  it("renders a grid and links a cell at once", async () => {
    render(<SkillMatrix content={content} initialFilter={filter} />);
    expect(screen.getByRole("grid")).toBeTruthy();
    const target = cell("C#", "SitePlus");
    expect(target.getAttribute("aria-checked")).toBe("false");
    await act(async () => fireEvent.click(target));
    expect(target.getAttribute("aria-checked")).toBe("true");
    expect(setSkillLink).toHaveBeenCalledWith("csharp", { projectId: "siteplus" }, true);
  });

  it("rolls back when the save fails", async () => {
    setSkillLink.mockResolvedValue({ ok: false, error: "nope" });
    render(<SkillMatrix content={content} initialFilter={filter} />);
    const target = cell("C#", "SitePlus");
    await act(async () => fireEvent.click(target));
    await act(async () => {});
    expect(target.getAttribute("aria-checked")).toBe("false");
  });

  it("moves with arrow keys and toggles with Space", async () => {
    render(<SkillMatrix content={content} initialFilter={filter} />);
    const first = cell("TypeScript", "AI Agent");
    first.focus();
    await act(async () => fireEvent.keyDown(first, { key: "ArrowRight" }));
    const next = document.activeElement as HTMLElement;
    expect(next).not.toBe(first);
    expect(next.getAttribute("role")).toBe("checkbox");
    const before = next.getAttribute("aria-checked");
    await act(async () => fireEvent.keyDown(next, { key: " " }));
    expect(next.getAttribute("aria-checked")).not.toBe(before);
  });

  it("refreshes the site cache once after a burst of toggles", async () => {
    render(<SkillMatrix content={content} initialFilter={filter} />);
    await act(async () => fireEvent.click(cell("C#", "SitePlus")));
    await act(async () => fireEvent.click(cell("C#", "ZodiacGems")));
    expect(flushContent).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(800));
    expect(flushContent).toHaveBeenCalledTimes(1);
  });

  it("keeps the last intent when a cell is clicked again before the first save returns", async () => {
    let resolveFirst!: (v: { ok: true }) => void;
    setSkillLink.mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)));
    render(<SkillMatrix content={content} initialFilter={filter} />);
    const target = cell("C#", "SitePlus");
    await act(async () => fireEvent.click(target));
    await act(async () => fireEvent.click(target));
    expect(setSkillLink).toHaveBeenCalledTimes(1);
    await act(async () => resolveFirst({ ok: true }));
    expect(setSkillLink).toHaveBeenLastCalledWith("csharp", { projectId: "siteplus" }, false);
    expect(target.getAttribute("aria-checked")).toBe("false");
  });

  it("still refreshes the site when the page is left before the pause ends", async () => {
    const { unmount } = render(<SkillMatrix content={content} initialFilter={filter} />);
    await act(async () => fireEvent.click(cell("C#", "SitePlus")));
    unmount();
    await act(async () => {});
    expect(flushContent).toHaveBeenCalledTimes(1);
  });

  it("refreshes the site only after the last write has landed", async () => {
    let resolveFirst!: (v: { ok: true }) => void;
    setSkillLink.mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)));
    render(<SkillMatrix content={content} initialFilter={filter} />);
    const target = cell("C#", "SitePlus");
    await act(async () => fireEvent.click(target));
    await act(async () => fireEvent.click(target));
    await act(async () => vi.advanceTimersByTime(800));
    expect(flushContent).not.toHaveBeenCalled();
    await act(async () => resolveFirst({ ok: true }));
    await act(async () => vi.advanceTimersByTime(800));
    expect(setSkillLink).toHaveBeenLastCalledWith("csharp", { projectId: "siteplus" }, false);
    expect(flushContent).toHaveBeenCalledTimes(1);
    expect(flushContent.mock.invocationCallOrder[0]).toBeGreaterThan(setSkillLink.mock.invocationCallOrder[1]);
  });

  it("rolls back and frees the cell when the request itself fails", async () => {
    setSkillLink.mockRejectedValueOnce(new Error("Failed to find Server Action"));
    render(<SkillMatrix content={content} initialFilter={filter} />);
    const target = cell("C#", "SitePlus");
    await act(async () => fireEvent.click(target));
    await act(async () => {});
    expect(target.getAttribute("aria-checked")).toBe("false");
    await act(async () => fireEvent.click(target));
    expect(setSkillLink).toHaveBeenCalledTimes(2);
    expect(target.getAttribute("aria-checked")).toBe("true");
  });

  it("refreshes the site after a request that was still running when the page was left", async () => {
    let resolveFirst!: (v: { ok: true }) => void;
    setSkillLink.mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)));
    const { unmount } = render(<SkillMatrix content={content} initialFilter={filter} />);
    await act(async () => fireEvent.click(cell("C#", "SitePlus")));
    unmount();
    await act(async () => {});
    expect(flushContent).not.toHaveBeenCalled();
    await act(async () => resolveFirst({ ok: true }));
    expect(flushContent).toHaveBeenCalledTimes(1);
  });
});
