import { act, fireEvent, render, screen, within } from "@testing-library/react";
import Link from "next/link";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { draftKey } from "@/lib/admin/drafts";
import { listRows } from "@/lib/admin/list-view";
import { resources } from "@/lib/admin/resources";
import type { MediaFile } from "@/lib/admin/media";

// The reviewer sees everything the admin sees, with no control that would try a write.
const a = vi.hoisted(() => ({
  listVersions: vi.fn(),
  listMedia: vi.fn(),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/certificates",
}));
vi.mock("@/app/admin/actions", () => ({
  deleteResource: vi.fn(),
  duplicateResource: vi.fn(),
  reorderResource: vi.fn(),
  togglePublished: vi.fn(),
  undoDelete: vi.fn(),
  saveResource: vi.fn(),
  saveSkillLinks: vi.fn(),
  saveProfile: vi.fn(),
  saveRole: vi.fn(),
  setOpenToWork: vi.fn(),
  listVersions: a.listVersions,
  restoreVersion: vi.fn(),
}));
vi.mock("@/app/admin/media-actions", () => ({
  listMedia: a.listMedia,
  deleteMedia: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: a.toast }));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabase: vi.fn() }));
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function () {};

const { AdminAccessProvider, AdminOnly, useAdminAccess } =
  await import("@/components/admin/AdminAccessProvider");
const { ReadOnlyNotice } = await import("@/components/admin/ReadOnlyNotice");
const { ResourceTable } = await import("@/components/admin/ResourceTable");
const { ResourceForm } = await import("@/components/admin/ResourceForm");
const { OpenToWorkSwitch } = await import("@/components/admin/SingletonForms");
const { SkillMatrix } = await import("@/components/admin/SkillMatrix");
const { VersionHistory } = await import("@/components/admin/VersionHistory");
const { MediaBrowser } = await import("@/components/admin/MediaBrowser");
const { UploadField } = await import("@/components/admin/UploadField");
const { QuickCreate } = await import("@/components/admin/QuickCreate");
const { buildCommandItems } = await import("@/lib/admin/command-items");

const content = contentSchema.parse(seed);
const { sortIndex: _s, ...cert } = content.certificates[0];
void _s;
type Kind = "admin" | "reviewer";
const as = (kind: Kind, ui: React.ReactNode) =>
  render(<AdminAccessProvider kind={kind}>{ui}</AdminAccessProvider>);

beforeEach(() => {
  localStorage.clear();
  a.listVersions.mockReset().mockResolvedValue({
    ok: true,
    versions: [
      {
        id: 9,
        op: "update",
        oldRow: { id: "x", name: "Tên cũ" },
        changedBy: "a@b.c",
        changedAt: new Date().toISOString(),
      },
    ],
    current: { id: "x", name: "Tên mới" },
  });
  const file = (name: string, uses: MediaFile["uses"] = []): MediaFile => ({
    bucket: "media",
    path: name,
    name,
    url: `https://project.supabase.co/storage/v1/object/public/media/${name}`,
    kind: "image",
    mime: "image/png",
    size: 50,
    createdAt: "2026-10-20T10:00:00Z",
    uses,
  });
  a.listMedia.mockReset().mockResolvedValue({
    ok: true,
    library: {
      files: [file("pond.png")],
      knownBytes: 50,
      unknownSizes: 0,
    },
  });
});

describe("access context", () => {
  it("defaults to the admin, so screens without a provider keep every control", () => {
    let seen: ReturnType<typeof useAdminAccess> | null = null;
    function Probe() {
      seen = useAdminAccess();
      return null;
    }
    render(<Probe />);
    expect(seen).toEqual({ kind: "admin", readOnly: false });
    as("reviewer", <Probe />);
    expect(seen).toEqual({ kind: "reviewer", readOnly: true });
  });

  it("shows the read-only notice as a status", () => {
    render(<ReadOnlyNotice />);
    expect(screen.getByRole("status").textContent).toContain(
      "Chế độ chỉ đọc — bạn có thể xem mọi nội dung nhưng không thể thay đổi.",
    );
  });

  it("AdminOnly hides its content from the reviewer (the list's Thêm mới)", () => {
    const add = <Link href="/admin/projects/new">Thêm mới</Link>;
    as("reviewer", <AdminOnly>{add}</AdminOnly>);
    expect(screen.queryByRole("link", { name: "Thêm mới" })).toBeNull();
    as("admin", <AdminOnly>{add}</AdminOnly>);
    expect(screen.getByRole("link", { name: "Thêm mới" })).toBeTruthy();
  });
});

describe("⌘K items", () => {
  it("drops the create group for the reviewer only", () => {
    const groups = (items: { group: string }[]) =>
      new Set(items.map((i) => i.group));
    expect(groups(buildCommandItems(content)).has("Tạo mới")).toBe(true);
    const reviewer = buildCommandItems(content, { readOnly: true });
    expect(groups(reviewer).has("Tạo mới")).toBe(false);
    expect(reviewer.some((i) => i.href.endsWith("/new"))).toBe(false);
    expect(groups(reviewer).has("Nội dung")).toBe(true);
  });
});

describe("ResourceTable", () => {
  const table = (kind: Kind) =>
    as(
      kind,
      <ResourceTable
        resourceKey="certificates"
        initialRows={listRows("certificates", content)}
      />,
    );
  const first = listRows("certificates", content)[0];

  it("reviewer: rows readable and linked, no write controls", () => {
    table("reviewer");
    expect(screen.getByText(first.label)).toBeTruthy();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: /Nhân bản/ })).toHaveLength(
      0,
    );
    expect(screen.queryAllByRole("button", { name: /^Xóa/ })).toHaveLength(0);
    expect(
      screen.queryAllByRole("button", { name: /Kéo để sắp xếp/ }),
    ).toHaveLength(0);
    expect(screen.queryAllByRole("link", { name: "Sửa" })).toHaveLength(0);
    const view = screen.getAllByRole("link", { name: "Xem" })[0];
    expect(view.getAttribute("href")).toBe(`/admin/certificates/${first.id}`);
  });

  it("admin: every control as before", () => {
    table("admin");
    expect(screen.getAllByRole("switch").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: /Nhân bản/ }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: /^Xóa/ }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: /Kéo để sắp xếp/ }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Sửa" }).length).toBeGreaterThan(
      0,
    );
  });
});

describe("ResourceForm / FieldsForm", () => {
  const key = draftKey(resources.certificates.table, cert.id);
  const form = (kind: Kind) =>
    as(
      kind,
      <ResourceForm
        resourceKey="certificates"
        isNew={false}
        initial={cert}
        options={{}}
      />,
    );
  const nameInput = () =>
    document.getElementById("field-name") as HTMLInputElement;
  beforeEach(() =>
    localStorage.setItem(
      key,
      JSON.stringify({
        // Only the edited field, as real drafts restore over the server values.
        values: { name: "Bản nháp" },
        savedAt: new Date().toISOString(),
        baseSignature: "old",
      }),
    ),
  );

  it("reviewer: values readable but disabled, no save bar, no draft offer", () => {
    form("reviewer");
    expect(nameInput().value).toBe(cert.name);
    expect(nameInput()).toBeDisabled();
    expect(nameInput().closest("fieldset")).toBeDisabled();
    expect(screen.queryByRole("region", { name: "Lưu thay đổi" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lưu" })).toBeNull();
    expect(screen.queryByText(/Có bản nháp chưa lưu/)).toBeNull();
  });

  it("admin: editable, with the save bar and the draft offer", () => {
    form("admin");
    expect(nameInput()).not.toBeDisabled();
    expect(screen.getByRole("region", { name: "Lưu thay đổi" })).toBeTruthy();
    expect(screen.getByText(/Có bản nháp chưa lưu/)).toBeTruthy();
  });
});

describe("OpenToWorkSwitch", () => {
  it("reviewer: disabled, and says why", () => {
    as("reviewer", <OpenToWorkSwitch initial />);
    const sw = screen.getByRole("switch");
    expect(sw).toBeDisabled();
    expect(sw).toBeChecked();
    expect(sw).toHaveAccessibleDescription(/chỉ đọc/i);
  });

  it("admin: can switch", () => {
    as("admin", <OpenToWorkSwitch initial />);
    expect(screen.getByRole("switch")).not.toBeDisabled();
  });
});

describe("SkillMatrix", () => {
  const all = {
    q: "",
    only: "all" as const,
    group: "all" as const,
    showHidden: true,
  };
  const cell = () =>
    document.querySelector<HTMLElement>(
      'button[role="checkbox"][aria-label="C# × SitePlus"]',
    )!;

  it("reviewer: cells read-only (click and keyboard), no add rows or save bar", () => {
    as("reviewer", <SkillMatrix content={content} initialFilter={all} />);
    const target = cell();
    const before = target.getAttribute("aria-checked");
    expect(target.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(target);
    fireEvent.keyDown(target, { key: " " });
    fireEvent.keyDown(target, { key: "Enter" });
    expect(target.getAttribute("aria-checked")).toBe(before);
    expect(screen.queryByText(/thay đổi chưa lưu/)).toBeNull();
    expect(
      screen.queryAllByRole("button", { name: /Thêm skill/ }),
    ).toHaveLength(0);
  });

  it("admin: cells toggle and groups offer + Thêm skill", () => {
    as("admin", <SkillMatrix content={content} initialFilter={all} />);
    const target = cell();
    expect(target.hasAttribute("aria-disabled")).toBe(false);
    fireEvent.click(target);
    expect(screen.getByText("1 thay đổi chưa lưu")).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /Thêm skill/ }).length,
    ).toBeGreaterThan(0);
  });
});

describe("VersionHistory", () => {
  async function openFirst(kind: Kind) {
    as(kind, <VersionHistory table="certificates" itemKey="x" />);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Lịch sử/ })),
    );
    const sheet = screen.getByRole("dialog", { name: "Lịch sử thay đổi" });
    await act(async () =>
      fireEvent.click(within(sheet).getAllByRole("button", { name: /Sửa/ })[0]),
    );
    return sheet;
  }

  it("reviewer: versions and diff, no restore", async () => {
    const sheet = await openFirst("reviewer");
    expect(within(sheet).getByText("Tên cũ")).toBeTruthy();
    expect(
      within(sheet).queryByRole("button", { name: /Khôi phục bản này/ }),
    ).toBeNull();
  });

  it("admin: restore offered", async () => {
    const sheet = await openFirst("admin");
    expect(
      within(sheet).getByRole("button", { name: /Khôi phục bản này/ }),
    ).toBeTruthy();
  });
});

describe("MediaBrowser", () => {
  it("reviewer: library lists and opens files, no delete", async () => {
    as("reviewer", <MediaBrowser />);
    await screen.findByText("pond.png");
    expect(screen.getByRole("link", { name: /Mở pond.png/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Xóa pond.png/ })).toBeNull();
  });

  it("admin: unused files can be deleted", async () => {
    as("admin", <MediaBrowser />);
    await screen.findByText("pond.png");
    expect(screen.getByRole("button", { name: /Xóa pond.png/ })).toBeTruthy();
  });

  it("reviewer: the picker only browses", async () => {
    as("reviewer", <MediaBrowser kind="image" onSelect={vi.fn()} />);
    await screen.findByText("pond.png");
    expect(screen.queryByRole("button", { name: /Chọn pond.png/ })).toBeNull();
  });

  it("admin: the picker selects", async () => {
    as("admin", <MediaBrowser kind="image" onSelect={vi.fn()} />);
    await screen.findByText("pond.png");
    expect(screen.getByRole("button", { name: /Chọn pond.png/ })).toBeTruthy();
  });
});

describe("UploadField", () => {
  const url =
    "https://project.supabase.co/storage/v1/object/public/media/a.png";
  const field = (kind: Kind) =>
    as(
      kind,
      <UploadField
        id="field-image"
        label="Ảnh"
        kind="image"
        value={url}
        onChange={vi.fn()}
      />,
    );

  it("reviewer: shows the file, no upload, remove or library pick", () => {
    field("reviewer");
    expect(screen.getByRole("link", { name: url })).toBeTruthy();
    expect(screen.queryByLabelText(/chọn tệp/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Gỡ" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Chọn từ thư viện" }),
    ).toBeNull();
  });

  it("admin: upload, remove and library pick", () => {
    field("admin");
    expect(screen.getByLabelText(/chọn tệp/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gỡ" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Chọn từ thư viện" }),
    ).toBeTruthy();
  });
});

describe("QuickCreate", () => {
  it("is hidden from the reviewer and shown to the admin", () => {
    as("reviewer", <QuickCreate />);
    expect(screen.queryByRole("navigation", { name: "Tạo nhanh" })).toBeNull();
    as("admin", <QuickCreate />);
    expect(screen.getByRole("navigation", { name: "Tạo nhanh" })).toBeTruthy();
  });
});
