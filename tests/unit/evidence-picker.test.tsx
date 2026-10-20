import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";

const saveResource = vi.fn();
const saveRole = vi.fn();
vi.mock("@/app/admin/actions", () => ({
  saveResource,
  saveRole,
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
const { emptyItem } = await import("@/lib/admin/empty-item");
const content = contentSchema.parse(seed);

beforeEach(() => {
  saveResource.mockReset().mockResolvedValue({ ok: true });
  saveRole.mockReset().mockResolvedValue({ ok: true });
});

describe("automatic IDs", () => {
  const renderNew = () =>
    render(
      <ResourceForm
        resourceKey="certificates"
        isNew
        initial={emptyItem("certificates")}
        options={{ existingIds: ["ielts"] }}
      />,
    );

  it("fills the ID from the name until you edit it", async () => {
    renderNew();
    const id = document.getElementById("field-id") as HTMLInputElement;
    await act(async () =>
      fireEvent.change(document.getElementById("field-name")!, {
        target: { value: "IELTS 7.0" },
      }),
    );
    expect(id.value).toBe("ielts-7-0");
    await act(async () => fireEvent.change(id, { target: { value: "my-id" } }));
    await act(async () =>
      fireEvent.change(document.getElementById("field-name")!, {
        target: { value: "Other" },
      }),
    );
    expect(id.value).toBe("my-id");
  });

  it("warns at once when the ID is taken", async () => {
    renderNew();
    await act(async () =>
      fireEvent.change(document.getElementById("field-id")!, {
        target: { value: "ielts" },
      }),
    );
    expect(
      screen.getByText('ID "ielts" đã được dùng, chọn ID khác'),
    ).toBeTruthy();
  });
});

describe("evidence link", () => {
  it("is chosen from experiences and projects", async () => {
    const { sortIndex: _s, ...card } = content.whyCards[0];
    void _s;
    render(
      <ResourceForm
        resourceKey="why_cards"
        isNew={false}
        initial={card}
        options={{
          evidence: {
            experiences: content.experiences.map((e) => ({
              id: e.id,
              label: e.company,
            })),
            projects: content.projects.map((p) => ({
              id: p.id,
              label: p.title,
            })),
          },
        }}
      />,
    );
    const select = document.getElementById(
      "field-evidenceLink",
    ) as HTMLSelectElement;
    expect(
      within(select).getByRole("group", { name: "Kinh nghiệm" }),
    ).toBeTruthy();
    expect(within(select).getByRole("group", { name: "Dự án" })).toBeTruthy();
    await act(async () =>
      fireEvent.change(select, { target: { value: "#proj-siteplus" } }),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Lưu" })),
    );
    expect(saveResource.mock.calls[0][1].evidenceLink).toBe("#proj-siteplus");
  });
});

describe("role tabs", () => {
  it("shows one role at a time and keeps unsaved edits when switching", async () => {
    const options = {
      experiences: content.experiences.map((e) => ({
        id: e.id,
        label: e.company,
      })),
    };
    render(<RoleTabs roles={content.roles} options={options} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    const firstTitle = document.getElementById(
      `field-${content.roles[0].key}-title.en`,
    ) as HTMLInputElement;
    await act(async () =>
      fireEvent.change(firstTitle, { target: { value: "Changed" } }),
    );
    fireEvent.click(tabs[1]);
    expect(
      screen.getAllByRole("tabpanel").filter((p) => !p.hidden),
    ).toHaveLength(1);
    fireEvent.click(tabs[0]);
    expect(
      (
        document.getElementById(
          `field-${content.roles[0].key}-title.en`,
        ) as HTMLInputElement
      ).value,
    ).toBe("Changed");
  });
});
