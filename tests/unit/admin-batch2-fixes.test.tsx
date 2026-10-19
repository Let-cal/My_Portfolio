import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";

const saveResource = vi.fn();
const saveRole = vi.fn();
vi.mock("@/app/admin/actions", () => ({ saveResource, saveRole, saveProfile: vi.fn(), setOpenToWork: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
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
const { I18nField, LocaleModeProvider } = await import("@/components/admin/I18nField");
const { describeIssues } = await import("@/lib/admin/validation");
const { PROFILE_FIELDS } = await import("@/lib/admin/singletons");
const content = contentSchema.parse(seed);
const roleOptions = { experiences: content.experiences.map((e) => ({ id: e.id, label: e.company })) };

/** Every link in the error summary must lead to an element that exists. */
function expectSummaryTargetsExist() {
  const summary = screen.getByRole("alert", { name: /mục cần sửa/ });
  for (const a of within(summary).getAllByRole("link")) {
    const id = a.getAttribute("href")!.slice(1);
    expect(document.getElementById(id), id).not.toBeNull();
  }
}

beforeEach(() => {
  saveResource.mockReset().mockResolvedValue({ ok: true });
  saveRole.mockReset().mockResolvedValue({ ok: true });
});

describe("roles page", () => {
  it("Ctrl+S saves only the role on screen", async () => {
    render(<RoleTabs roles={content.roles} options={roleOptions} />);
    const title = (key: string) => document.getElementById(`field-${key}-title.en`)!;
    fireEvent.change(title(content.roles[0].key), { target: { value: "Edited first" } });
    fireEvent.click(screen.getAllByRole("tab")[1]);
    fireEvent.change(title(content.roles[1].key), { target: { value: "Edited second" } });
    await act(async () => fireEvent.keyDown(window, { key: "s", ctrlKey: true }));
    expect(saveRole).toHaveBeenCalledTimes(1);
    expect(saveRole.mock.calls[0][0].key).toBe(content.roles[1].key);
  });

  it("marks the CV as required and explains a missing one on the upload itself", async () => {
    const roles = [{ ...content.roles[0], cvFileUrl: "" }];
    render(<RoleTabs roles={roles} options={roleOptions} />);
    const label = screen.getByText("CV (PDF)");
    expect(label.closest("label, legend")!.textContent).toContain("*");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Lưu" })));
    expect(saveRole).not.toHaveBeenCalled();
    const summary = screen.getByRole("alert", { name: /mục cần sửa/ });
    expect(within(summary).getByRole("link", { name: "Tải lên CV" })).toBeTruthy();
    expectSummaryTargetsExist();
  });
});

describe("chips", () => {
  it("names the wrong value and links to the chip input", async () => {
    const { sortIndex: _s, ...project } = content.projects[0];
    void _s;
    render(
      <ResourceForm
        resourceKey="projects"
        isNew={false}
        initial={{ ...project, repoUrls: ["github.com/x"], skillIds: [] }}
        options={{}}
      />,
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Lưu" })));
    const summary = screen.getByRole("alert", { name: /mục cần sửa/ });
    expect(within(summary).getByRole("link", { name: /"github\.com\/x"/ })).toBeTruthy();
    expectSummaryTargetsExist();
    expect(screen.getByText("github.com/x").closest("li")!.className).toContain("border-destructive");
  });
});

describe("single-language mode", () => {
  it("keeps the English box while you fix its error", async () => {
    function Field() {
      const [value, setValue] = useState({ en: "", ja: "こんにちは", vi: "" });
      const errors = value.en ? {} : { en: "Nhập mô tả (EN)" };
      return (
        <LocaleModeProvider initialMode="ja">
          <I18nField label="Mô tả" idPrefix="description" required value={value} errors={errors} onChange={setValue} />
        </LocaleModeProvider>
      );
    }
    render(<Field />);
    const en = document.getElementById("field-description.en")!;
    en.focus();
    fireEvent.change(en, { target: { value: "H" } });
    expect(document.getElementById("field-description.en")).not.toBeNull();
    expect(document.activeElement).toBe(document.getElementById("field-description.en"));
  });
});

describe("messages", () => {
  it("keeps brand names as written", () => {
    const issues = [{ path: ["github"], code: "too_small", message: "x" }];
    const [e] = describeIssues(issues, PROFILE_FIELDS, { github: "" });
    expect(e.message).toBe("Nhập GitHub");
  });
});
