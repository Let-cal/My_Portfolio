import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";

const saveResource = vi.fn();
vi.mock("@/app/admin/actions", () => ({
  saveResource,
  saveRole: vi.fn(),
  saveProfile: vi.fn(),
  setOpenToWork: vi.fn(),
}));
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
const { RoleTabs } = await import("@/components/admin/SingletonForms");
const { LocaleModeProvider, LocaleModeSwitch } =
  await import("@/components/admin/I18nField");
const { FieldError } = await import("@/components/admin/FieldShell");
const { useUnsavedGuard } = await import("@/components/admin/SaveBar");
const content = contentSchema.parse(seed);
const strip = <T extends { sortIndex: number }>({
  sortIndex: _s,
  ...rest
}: T) => (void _s, rest);

beforeEach(() => {
  saveResource.mockReset().mockResolvedValue({ ok: true });
  localStorage.clear();
});

describe("accessibility follow-ups", () => {
  it("colour inputs announce their error", async () => {
    const card = { ...strip(content.whyCards[0]), colors: ["nope", "#000000"] };
    render(
      <ResourceForm
        resourceKey="why_cards"
        isNew={false}
        initial={card}
        options={{}}
      />,
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Lưu" })),
    );
    const from = screen.getByLabelText("Màu bắt đầu");
    expect(from.getAttribute("aria-invalid")).toBe("true");
    const describedBy = from.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)?.textContent).toMatch(
      /#RRGGBB/,
    );
  });

  it("an optional translated note can be added, is EN-required once open, and can be removed", async () => {
    const school = { ...strip(content.education[0]), notes: null };
    render(
      <ResourceForm
        resourceKey="education"
        isNew={false}
        initial={school}
        options={{}}
      />,
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Thêm" })),
    );
    const group = screen.getByRole("group", { name: /Ghi chú/ });
    expect(
      within(group).getAllByText("(bắt buộc)", { exact: false }).length,
    ).toBeGreaterThan(0);
    await act(async () =>
      fireEvent.click(within(group).getByRole("button", { name: /Bỏ/ })),
    );
    expect(screen.queryByRole("group", { name: /Ghi chú/ })).toBeNull();
    expect(screen.getByText(/Ghi chú: chưa có/)).toBeTruthy();
  });

  it("the language switch moves with arrow keys (one tab stop)", async () => {
    render(
      <LocaleModeProvider>
        <LocaleModeSwitch />
      </LocaleModeProvider>,
    );
    const all = screen.getByRole("radio", { name: "Cả 3" });
    expect(all.tabIndex).toBe(0);
    expect(screen.getByRole("radio", { name: "EN" }).tabIndex).toBe(-1);
    all.focus();
    await act(async () => fireEvent.keyDown(all, { key: "ArrowRight" }));
    const en = screen.getByRole("radio", { name: "EN" });
    expect(en.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(en);
    await act(async () => fireEvent.keyDown(en, { key: "End" }));
    expect(
      screen.getByRole("radio", { name: "VI" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("the role tabs move with arrow keys", async () => {
    render(<RoleTabs roles={content.roles} options={{ experiences: [] }} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[1].tabIndex).toBe(-1);
    tabs[0].focus();
    await act(async () => fireEvent.keyDown(tabs[0], { key: "ArrowRight" }));
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs[1]);
    await act(async () => fireEvent.keyDown(tabs[1], { key: "ArrowLeft" }));
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  });

  it("the error summary is focused but not an alert (GOV.UK pattern)", async () => {
    const card = { ...strip(content.whyCards[0]), colors: ["nope", "#000000"] };
    render(
      <ResourceForm
        resourceKey="why_cards"
        isNew={false}
        initial={card}
        options={{}}
      />,
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Lưu" })),
    );
    expect(screen.queryByRole("alert", { name: /mục cần sửa/ })).toBeNull();
    const summary = screen.getByRole("region", { name: /mục cần sửa/ });
    expect(document.activeElement).toBe(summary);
  });

  it("inline errors start with a hidden 'Lỗi:' for screen readers", () => {
    render(<FieldError id="x" message="Nhập tên" />);
    const el = document.getElementById("x-error")!;
    expect(el.textContent).toBe("Lỗi: Nhập tên");
    expect(within(el).getByText("Lỗi:", { exact: false }).className).toContain(
      "sr-only",
    );
  });

  it("several unsaved forms ask only once before leaving", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    function Dirty() {
      useUnsavedGuard(true);
      return null;
    }
    render(
      <>
        <Dirty />
        <Dirty />
        <a href="https://example.com/x">đi</a>
      </>,
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("link", { name: "đi" })),
    );
    expect(confirm).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it("the evidence select shows its saved value in the server HTML", () => {
    const exp = content.experiences[0];
    const card = {
      ...strip(content.whyCards[0]),
      evidenceLink: `#exp-${exp.id}`,
    };
    const html = renderToString(
      <ResourceForm
        resourceKey="why_cards"
        isNew={false}
        initial={card}
        options={{
          evidence: {
            experiences: [{ id: exp.id, label: exp.company }],
            projects: [],
          },
        }}
      />,
    );
    expect(html).toMatch(
      new RegExp(`<option value="#exp-${exp.id}" selected="">`),
    );
  });
});
