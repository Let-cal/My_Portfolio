import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";

const saveResource = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/app/admin/actions", () => ({ saveResource }));
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

const { ResourceForm } = await import("@/components/admin/ResourceForm");
const project = contentSchema.parse(seed).projects[0];

describe("ResourceForm skills field", () => {
  it("sends the chosen skills with the project although the schema does not know them", async () => {
    render(
      <ResourceForm
        resourceKey="projects"
        isNew={false}
        initial={{ ...project, skillIds: ["react"] }}
        options={{
          skills: [
            { id: "react", label: "React", group: "frameworks" },
            { id: "dart", label: "Dart", group: "languages" },
          ],
        }}
      />,
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Skills dùng ở đây" }),
      { target: { value: "dar" } },
    );
    fireEvent.click(screen.getByRole("option", { name: "Dart" }));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Lưu" })),
    );
    expect(saveResource).toHaveBeenCalledTimes(1);
    const [key, values, isNew] = saveResource.mock.calls[0];
    expect(key).toBe("projects");
    expect(isNew).toBe(false);
    expect(values.skillIds).toEqual(["react", "dart"]);
    expect(values.title).toBe(project.title);
  });
});
