import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import vi_messages from "@/messages/vi.json";
import { STAR_LIMIT_MESSAGE } from "@/lib/featured";
import { buildJourney } from "@/lib/journey";
import { listRows } from "@/lib/admin/list-view";

// The admin side of "where a project belongs, role tags and up to three stars".
const a = vi.hoisted(() => ({
  saveResource: vi.fn(),
  toggleFeatured: vi.fn(),
  reorderFeatured: vi.fn(),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/app/admin/actions", () => ({
  saveResource: a.saveResource,
  toggleFeatured: a.toggleFeatured,
  reorderFeatured: a.reorderFeatured,
  deleteResource: vi.fn(),
  duplicateResource: vi.fn(),
  reorderResource: vi.fn(),
  togglePublished: vi.fn(),
  undoDelete: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/projects",
}));
vi.mock("sonner", () => ({ toast: a.toast }));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabase: vi.fn() }));
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function () {};

const { AdminAccessProvider } =
  await import("@/components/admin/AdminAccessProvider");
const { ResourceForm } = await import("@/components/admin/ResourceForm");
const { ResourceTable } = await import("@/components/admin/ResourceTable");
const { CompanyHeaderPreview } =
  await import("@/components/admin/CompanyHeaderPreview");
const { resources } = await import("@/lib/admin/resources");
const { emptyItem } = await import("@/lib/admin/empty-item");
const { evidenceOptions, ROLE_LABELS, whereOptions } =
  await import("@/lib/admin/project-options");

const content = contentSchema.parse(seed);
const where = whereOptions(content.experiences, content.education);
const strip = <T extends { sortIndex: number }>(item: T) => {
  const { sortIndex: _s, ...rest } = item;
  void _s;
  return rest;
};
const project = (id: string) =>
  strip(content.projects.find((p) => p.id === id)!);
const renderProject = (initial: Record<string, unknown>, isNew = false) =>
  render(
    <ResourceForm
      resourceKey="projects"
      isNew={isNew}
      initial={initial}
      options={{ where }}
    />,
  );
const whereSelect = () =>
  screen.getByLabelText("Thuộc về") as HTMLSelectElement;
const save = () =>
  act(async () => fireEvent.click(screen.getByRole("button", { name: "Lưu" })));
const saved = () => a.saveResource.mock.calls.at(-1)![1];

beforeEach(() => {
  localStorage.clear();
  a.saveResource.mockReset().mockResolvedValue({ ok: true });
  a.toggleFeatured.mockReset().mockResolvedValue({ ok: true });
  a.reorderFeatured.mockReset().mockResolvedValue({ ok: true });
  a.toast.success.mockReset();
  a.toast.error.mockReset();
});

describe("projects form: where the project belongs", () => {
  it("Where select lists SKG stints, FPT University and Cá nhân", () => {
    renderProject(project("skg-coa"));
    const select = whereSelect();
    const skg = within(select).getByRole("group", {
      name: "SKG Software (Splus)",
    });
    expect(
      within(skg)
        .getAllByRole("option")
        .map((o) => (o as HTMLOptionElement).value),
    ).toEqual(["exp:skg-engineer", "exp:skg-intern"]);
    expect(within(skg).getAllByRole("option")[0].textContent).toContain(
      "Software Engineer — acting Project Manager / Tech Lead",
    );
    const schools = within(select).getByRole("group", { name: "Trường" });
    expect(within(schools).getByRole("option").textContent).toBe(
      "FPT University",
    );
    expect(
      within(select).getByRole("option", { name: "Cá nhân" }),
    ).toBeTruthy();
    expect(select.value).toBe("exp:skg-engineer");
  });

  it("shows the kind read-only, derived from the choice, and saves the three together", async () => {
    renderProject(project("skg-coa"));
    expect(screen.getByText("Công việc")).toBeTruthy();
    await act(async () =>
      fireEvent.change(whereSelect(), {
        target: { value: "edu:fpt-university" },
      }),
    );
    expect(screen.getByText("Đại học")).toBeTruthy();
    await save();
    expect(saved()).toMatchObject({
      experienceId: null,
      educationId: "fpt-university",
      kind: "university",
    });
    await act(async () =>
      fireEvent.change(whereSelect(), { target: { value: "personal" } }),
    );
    await save();
    expect(saved()).toMatchObject({
      experienceId: null,
      educationId: null,
      kind: "personal",
    });
  });

  it("a new project starts personal, unstarred, without role tags", () => {
    const item = emptyItem("projects");
    expect(item).toMatchObject({
      experienceId: null,
      educationId: null,
      kind: "personal",
      featured: false,
      featuredOrder: null,
      roles: [],
      links: [],
      teamSize: null,
    });
    renderProject(item, true);
    expect(whereSelect().value).toBe("personal");
  });

  it("shows the kind / link rule near Thuộc về instead of saving", async () => {
    renderProject({ ...project("skg-coa"), kind: "personal" });
    await save();
    expect(a.saveResource).not.toHaveBeenCalled();
    const select = whereSelect();
    expect(select.getAttribute("aria-invalid")).toBe("true");
    const message = document.getElementById(
      select.getAttribute("aria-describedby")!.split(" ").at(-1)!,
    )!.textContent!;
    expect(message).toMatch(/Thuộc về/);
    const summary = screen.getByRole("region", { name: /mục cần sửa/ });
    const link = within(summary).getByRole("link", { name: /Thuộc về/ });
    expect(link.getAttribute("href")).toBe(`#${select.id}`);
  });

  it("role tags use the site's Vietnamese role labels and are saved", async () => {
    expect(ROLE_LABELS).toEqual({
      fullstack: vi_messages.roles.fullstack,
      techlead: vi_messages.roles.techlead,
      pm: vi_messages.roles.pm,
    });
    renderProject(project("skg-coa"));
    const pm = screen.getByRole("checkbox", { name: "Quản lý dự án" });
    expect((pm as HTMLInputElement).checked).toBe(false);
    expect(
      (screen.getByRole("checkbox", { name: "Tech Lead" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    await act(async () => fireEvent.click(pm));
    await save();
    expect(saved().roles).toEqual(["fullstack", "techlead", "pm"]);
  });

  it("team size and extra links are editable", async () => {
    renderProject(project("skg-coa"));
    await act(async () =>
      fireEvent.change(screen.getByLabelText(/Quy mô team/), {
        target: { value: "6" },
      }),
    );
    await act(async () =>
      fireEvent.click(
        screen.getAllByRole("button", { name: "Thêm liên kết" }).at(-1)!,
      ),
    );
    await act(async () =>
      fireEvent.change(screen.getByLabelText("Nhãn liên kết 1"), {
        target: { value: "Docs" },
      }),
    );
    await act(async () =>
      fireEvent.change(screen.getByLabelText("URL liên kết 1"), {
        target: { value: "https://example.com/docs" },
      }),
    );
    await save();
    expect(saved()).toMatchObject({
      teamSize: "6",
      links: [{ label: "Docs", url: "https://example.com/docs" }],
    });
  });

  it("every project field is in a form section", () => {
    const placed = resources.projects.sections!.flatMap((s) => s.fields);
    for (const f of resources.projects.fields)
      expect(placed, f.name).toContain(f.name);
  });
});

describe("projects list: stars and the featured strip", () => {
  const rows = () => listRows("projects", content);
  const table = (kind: "admin" | "reviewer" = "admin", r = rows()) =>
    render(
      <AdminAccessProvider kind={kind}>
        <ResourceTable resourceKey="projects" initialRows={r} />
      </AdminAccessProvider>,
    );
  const star = (title: string) =>
    screen.getByRole("button", { name: `Nổi bật trên trang chủ: ${title}` });
  const strip = () =>
    screen.getByRole("list", { name: "Thứ tự dự án nổi bật" });

  it("each row has a labelled star toggle with its state", () => {
    table();
    expect(star("SitePlus").getAttribute("aria-pressed")).toBe("true");
    expect(
      star("COA (Certificate of Analysis system)").getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("refuses a 4th star inline, without calling the server", async () => {
    table();
    const coa = star("COA (Certificate of Analysis system)");
    await act(async () => fireEvent.click(coa));
    expect(a.toggleFeatured).not.toHaveBeenCalled();
    expect(coa.getAttribute("aria-pressed")).toBe("false");
    const row = coa.closest("li")!;
    expect(within(row).getByRole("alert").textContent).toBe(STAR_LIMIT_MESSAGE);
  });

  it("removing a star calls toggleFeatured and frees the slot in the strip", async () => {
    table();
    await act(async () => fireEvent.click(star("ZodiacGems")));
    expect(a.toggleFeatured).toHaveBeenCalledWith("zodiacgems");
    expect(star("ZodiacGems").getAttribute("aria-pressed")).toBe("false");
    expect(
      within(strip())
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      expect.stringContaining("SitePlus"),
      expect.stringContaining("Meet My Lecturer"),
    ]);
    await act(async () =>
      fireEvent.click(star("COA (Certificate of Analysis system)")),
    );
    expect(a.toggleFeatured).toHaveBeenLastCalledWith("skg-coa");
  });

  it("the strip lists the starred projects by featured order, each with a drag handle", () => {
    const r = rows().map((row) =>
      row.id === "siteplus" ? { ...row, featuredOrder: 9 } : row,
    );
    table("admin", r);
    const items = within(strip()).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining("ZodiacGems"),
      expect.stringContaining("Meet My Lecturer"),
      expect.stringContaining("SitePlus"),
    ]);
    for (const li of items)
      expect(
        within(li).getByRole("button", { name: /Kéo để sắp xếp/ }),
      ).toBeTruthy();
  });

  it("says how the home page fills the empty slots", () => {
    table(
      "admin",
      rows().map((row) => ({ ...row, featured: false, featuredOrder: null })),
    );
    expect(screen.getByText(/Chưa gắn sao dự án nào/).textContent).toMatch(
      /mới nhất/,
    );
  });

  it("reviewer: sees the stars and the order, with no toggle and no drag", () => {
    table("reviewer");
    expect(
      screen.queryAllByRole("button", { name: /Nổi bật trên trang chủ/ }),
    ).toHaveLength(0);
    expect(
      within(strip()).queryAllByRole("button", { name: /Kéo để sắp xếp/ }),
    ).toHaveLength(0);
    expect(within(strip()).getAllByRole("listitem")).toHaveLength(3);
  });
});

describe("positions screen", () => {
  it("is called Vị trí làm việc", () => {
    expect(resources.experiences.label).toBe("Vị trí làm việc");
  });

  it("positions screen shows a preview of the company header (name + stint lines) built with buildJourney", () => {
    render(<CompanyHeaderPreview content={content} />);
    const preview = screen.getByRole("region", {
      name: /Xem trước trên cây kinh nghiệm/,
    });
    const companies = buildJourney(content, "en", (k) => k).filter(
      (p) => p.kind === "company",
    );
    expect(companies.map((c) => c.name)).toContain("SKG Software (Splus)");
    for (const company of companies) {
      const card = within(preview).getByRole("listitem", {
        name: company.name,
      });
      expect(card.textContent).toContain(company.period);
      for (const line of company.lines) {
        expect(card.textContent).toContain(line.title);
        expect(card.textContent).toContain(line.period);
      }
    }
    const skg = within(preview).getByRole("listitem", {
      name: "SKG Software (Splus)",
    });
    expect(skg.textContent).toContain("Software Engineer Intern");
    // Schools are not positions.
    expect(within(preview).queryByText("FPT University")).toBeNull();
  });
});

describe("why card evidence", () => {
  const options = { evidence: evidenceOptions(content) };
  const values = (select: HTMLSelectElement) =>
    [...select.options].map((o) => o.value);

  it("offers the anchors that exist now: tree parents, tree children and home cards", () => {
    const { sortIndex: _s, ...card } = content.whyCards[0];
    void _s;
    render(
      <ResourceForm
        resourceKey="why_cards"
        isNew={false}
        initial={{ ...card, evidenceLink: "#tree-skg-coa" }}
        options={options}
      />,
    );
    const select = document.getElementById(
      "field-evidenceLink",
    ) as HTMLSelectElement;
    const all = values(select);
    expect(all).toEqual(
      expect.arrayContaining([
        "#exp-skg-software",
        "#exp-fpt-japan",
        "#exp-fpt-university",
        "#tree-skg-coa",
        "#tree-siteplus",
        "#proj-siteplus",
        "#proj-zodiacgems",
        "#proj-meet-my-lecturer",
      ]),
    );
    expect(all).not.toContain("#exp-skg-coa");
    expect(all).not.toContain("#proj-skg-coa");
    expect(select.value).toBe("#tree-skg-coa");
  });

  it("keeps an old link visible as such, so it is not lost silently", () => {
    const { sortIndex: _s, ...card } = content.whyCards[0];
    void _s;
    render(
      <ResourceForm
        resourceKey="why_cards"
        isNew={false}
        initial={{ ...card, evidenceLink: "#exp-skg-coa" }}
        options={options}
      />,
    );
    const select = document.getElementById(
      "field-evidenceLink",
    ) as HTMLSelectElement;
    expect(select.value).toBe("#exp-skg-coa");
    expect(
      within(select).getByRole("group", { name: /không còn trên trang/ }),
    ).toBeTruthy();
  });
});
