import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DiagramFigure, Figure, ImageFigure } from "@/content/schema";
import { projectSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { resources, withoutSortIndex } from "@/lib/admin/resources";
import { adminResolver } from "@/lib/admin/validation";
import { MERMAID_THEME_VERSION } from "@/lib/figures/mermaid-theme";

const PICKED =
  "https://proj.supabase.co/storage/v1/object/public/media/image/abc12345-shot.png";

vi.mock("@/components/admin/MediaBrowser", () => ({
  MediaBrowser: ({ onSelect }: { onSelect: (url: string) => void }) => (
    <button type="button" onClick={() => onSelect(PICKED)}>
      Chọn ảnh thử
    </button>
  ),
}));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabase: vi.fn() }));
const h = vi.hoisted(() => ({
  saveResource: vi.fn(),
  render: vi.fn(),
  upload: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: h.toastError, success: vi.fn() }),
}));
vi.mock("@/app/admin/actions", () => ({
  saveResource: h.saveResource,
  undoDelete: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/admin/figures-client", () => ({
  lazyRenderDiagram: h.render,
  uploadDiagramSvg: h.upload,
  uploadImage: vi.fn(),
  readImageSize: vi.fn(),
}));
Element.prototype.scrollIntoView ??= function () {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const { FiguresField } = await import("@/components/admin/FiguresField");
const { ResourceForm } = await import("@/components/admin/ResourceForm");
const { AdminAccessProvider } =
  await import("@/components/admin/AdminAccessProvider");

const text = (en: string) => ({ en, ja: "", vi: "" });
const PUBLIC = "https://proj.supabase.co/storage/v1/object/public/media";

function image(id: string, caption = id): ImageFigure {
  return {
    id,
    kind: "image",
    category: "screen",
    caption: text(caption),
    note: { en: "" },
    alt: text(`Alt ${id}`),
    url: `${PUBLIC}/image/${id}.png`,
    width: 800,
    height: 600,
  };
}
function diagram(
  id: string,
  patch: Partial<DiagramFigure> = {},
): DiagramFigure {
  return {
    id,
    kind: "diagram",
    category: "architecture",
    caption: text(id),
    note: { en: "" },
    alt: text(`Alt ${id}`),
    source: "flowchart LR; A-->B",
    svgLight: `${PUBLIC}/diagram/p-${id}-light-0000000a.svg`,
    svgDark: `${PUBLIC}/diagram/p-${id}-dark-0000000b.svg`,
    width: 100,
    height: 40,
    renderedAt: "2026-10-31T00:00:00.000Z",
    themeVersion: MERMAID_THEME_VERSION,
    ...patch,
  };
}

type Props = Partial<React.ComponentProps<typeof FiguresField>> & {
  initial: Figure[];
  access?: "admin" | "reviewer";
};
function Harness({ initial, access = "admin", ...rest }: Props) {
  const [value, setValue] = useState<Figure[]>(initial);
  return (
    <AdminAccessProvider kind={access}>
      <FiguresField
        id="field-media"
        name="media"
        idPrefix="media"
        label="Hình ảnh & sơ đồ"
        value={value}
        onChange={setValue}
        errors={[]}
        readImageSize={async () => ({ width: 1280, height: 720 })}
        render={async () => ({ svg: "<svg/>", width: 10, height: 10 })}
        {...rest}
      />
    </AdminAccessProvider>
  );
}

const captions = () =>
  screen.getAllByTestId("figure-caption").map((el) => el.textContent?.trim());

describe("FiguresField", () => {
  it("Move up and Move down reorder figures", () => {
    render(<Harness initial={[image("one"), image("two"), image("three")]} />);
    expect(captions()).toEqual(["one", "two", "three"]);
    fireEvent.click(screen.getByRole("button", { name: "Đưa hình 2 lên" }));
    expect(captions()).toEqual(["two", "one", "three"]);
    fireEvent.click(screen.getByRole("button", { name: "Đưa hình 2 xuống" }));
    expect(captions()).toEqual(["two", "three", "one"]);
    expect(
      screen.getByRole("button", { name: "Đưa hình 1 lên" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Đưa hình 3 xuống" }),
    ).toBeDisabled();
  });

  it("the reviewer sees figures read-only, with no add, edit, render or save controls", () => {
    render(
      <Harness
        access="reviewer"
        initial={[image("one"), diagram("two", { themeVersion: 0 })]}
      />,
    );
    expect(captions()).toEqual(["one", "two"]);
    // Previews stay visible.
    expect(
      screen.getAllByRole("img").map((img) => img.getAttribute("src")),
    ).toEqual([
      `${PUBLIC}/image/one.png`,
      `${PUBLIC}/diagram/p-two-light-0000000a.svg`,
    ]);
    for (const name of [
      /Thêm ảnh/,
      /Thêm sơ đồ/,
      /^Sửa/,
      /Vẽ lại/,
      /lên$/,
      /xuống$/,
      /^Xóa/,
      /Lưu/,
      /Kéo để sắp xếp/,
    ]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("adding an image on a work project shows the client-screens warning", async () => {
    render(<Harness initial={[]} projectKind="work" />);
    expect(screen.queryByText(/màn hình hoặc dữ liệu của khách/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thêm ảnh" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Chọn ảnh thử" }),
    );
    await waitFor(() => expect(captions()).toHaveLength(1));
    expect(screen.getByText(/màn hình hoặc dữ liệu của khách/)).toBeTruthy();
    // A warning, not a block: the image is in the list.
    expect(screen.getByRole("img").getAttribute("src")).toBe(PICKED);
  });

  it("does not warn for a personal project", async () => {
    render(<Harness initial={[]} projectKind="personal" />);
    fireEvent.click(screen.getByRole("button", { name: "Thêm ảnh" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Chọn ảnh thử" }),
    );
    await waitFor(() => expect(captions()).toHaveLength(1));
    expect(screen.queryByText(/màn hình hoặc dữ liệu của khách/)).toBeNull();
  });

  it("a diagram older than the theme version shows Cần vẽ lại", () => {
    render(
      <Harness
        initial={[
          diagram("old", { themeVersion: MERMAID_THEME_VERSION - 1 }),
          diagram("current"),
        ]}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("Cần vẽ lại")).toBeTruthy();
    expect(within(rows[1]).queryByText("Cần vẽ lại")).toBeNull();
  });

  it("Vẽ lại tất cả sơ đồ marks every diagram for the next save", () => {
    render(<Harness initial={[diagram("a"), diagram("b"), image("c")]} />);
    expect(screen.queryAllByText("Cần vẽ lại")).toHaveLength(0);
    fireEvent.click(
      screen.getByRole("button", { name: "Vẽ lại tất cả sơ đồ" }),
    );
    expect(screen.getAllByText("Cần vẽ lại")).toHaveLength(2);
  });

  it("a Mermaid syntax error shows the parser message and keeps the last good preview dimmed", async () => {
    const renderStub = vi.fn(async (source: string) => {
      if (source.trim().endsWith("-->"))
        throw new Error(
          "Parse error on line 1:\nflowchart LR; A-->\n-----------------^\nExpecting 'NODE_STRING', got 'EOF'",
        );
      return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg"><text>${source}</text></svg>`,
        width: 10,
        height: 10,
      };
    });
    render(<Harness initial={[diagram("d")]} render={renderStub} />);
    fireEvent.click(screen.getByRole("button", { name: "Sửa hình 1" }));
    const preview = await screen.findByTestId("diagram-preview");
    await waitFor(() =>
      expect(preview.getAttribute("src")).toMatch(/^data:image\/svg\+xml/),
    );
    const good = preview.getAttribute("src");
    expect(preview).toHaveAttribute("data-stale", "false");

    fireEvent.change(screen.getByRole("textbox", { name: /Mã Mermaid/ }), {
      target: { value: "flowchart LR; A-->" },
    });
    const alert = await screen.findByRole("alert", {}, { timeout: 2000 });
    expect(alert.textContent).toContain("Parse error on line 1");
    expect(alert.textContent).toContain("Expecting 'NODE_STRING'");
    const stale = screen.getByTestId("diagram-preview");
    expect(stale.getAttribute("src")).toBe(good);
    expect(stale).toHaveAttribute("data-stale", "true");

    fireEvent.change(screen.getByRole("textbox", { name: /Mã Mermaid/ }), {
      target: { value: "flowchart LR; A-->B" },
    });
    await waitFor(
      () =>
        expect(screen.getByTestId("diagram-preview")).toHaveAttribute(
          "data-stale",
          "false",
        ),
      { timeout: 2000 },
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("waits 400 ms after typing stops before rendering the preview", async () => {
    vi.useFakeTimers();
    try {
      const renderStub = vi.fn(async () => ({
        svg: "<svg/>",
        width: 1,
        height: 1,
      }));
      render(<Harness initial={[diagram("d")]} render={renderStub} />);
      fireEvent.click(screen.getByRole("button", { name: "Sửa hình 1" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      renderStub.mockClear();
      const box = screen.getByRole("textbox", { name: /Mã Mermaid/ });
      fireEvent.change(box, { target: { value: "flowchart LR; A-->C" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      fireEvent.change(box, { target: { value: "flowchart LR; A-->D" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(399);
      });
      expect(renderStub).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(renderStub).toHaveBeenCalledTimes(1);
      expect(renderStub.mock.calls[0]).toEqual([
        "flowchart LR; A-->D",
        "light",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens a row that has an error and shows the message on its input", () => {
    render(
      <Harness
        initial={[image("one", "")]}
        errors={[
          { path: "media.0.caption.en", message: "Nhập chú thích (EN)" },
        ]}
      />,
    );
    const input = document.getElementById("field-media.0.caption.en");
    expect(input).toBeTruthy();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Nhập chú thích (EN)")).toBeTruthy();
  });
});

describe("figure validation messages", () => {
  const fields = resources.projects.fields;
  const resolver = adminResolver(withoutSortIndex(projectSchema), fields);
  const project = (() => {
    const p = seed.projects.find((x) => x.id === "siteplus")!;
    const { sortIndex: _s, ...rest } = p as typeof p & { sortIndex: number };
    void _s;
    return rest;
  })();
  const messages = async (media: unknown[]) => {
    const result = await resolver(
      { ...project, media } as Record<string, unknown>,
      undefined,
      { fields: {}, shouldUseNativeValidation: false },
    );
    const out: Record<string, string> = {};
    const walk = (node: unknown, path: string[]) => {
      if (!node || typeof node !== "object") return;
      const message = (node as { message?: unknown }).message;
      if (typeof message === "string") out[path.join(".")] = message;
      else for (const [k, v] of Object.entries(node)) walk(v, [...path, k]);
    };
    walk(result.errors, []);
    return out;
  };

  it("caption and alt are required in EN", async () => {
    const bad = { ...image("one"), caption: text(""), alt: text("") };
    expect(await messages([bad])).toEqual({
      "media.0.caption.en": "Nhập chú thích (EN)",
      "media.0.alt.en": "Nhập mô tả hình (EN)",
    });
  });

  it("at most 12 figures", async () => {
    const many = Array.from({ length: 13 }, (_, i) => image(`f-${i}`));
    expect(await messages(many)).toEqual({
      media: "Tối đa 12 hình cho mỗi dự án",
    });
  });

  it("a new diagram may have no rendering yet, but needs its source", async () => {
    const draft = diagram("new", {
      svgLight: "",
      svgDark: "",
      width: 0,
      height: 0,
      renderedAt: "",
      themeVersion: 0,
    });
    expect(await messages([draft])).toEqual({});
    expect(await messages([{ ...draft, source: " " }])).toEqual({
      "media.0.source": "Nhập mã Mermaid của sơ đồ",
    });
  });

  it("caption length is capped", async () => {
    const long = { ...image("one"), caption: text("x".repeat(141)) };
    expect(await messages([long])).toEqual({
      "media.0.caption.en": "Chú thích tối đa 140 ký tự (EN)",
    });
  });
});

describe("project save with figures", () => {
  const siteplus = seed.projects.find((x) => x.id === "siteplus")!;
  const fresh = diagram("fresh", {
    source: "flowchart LR; A-->B",
    svgLight: "",
    svgDark: "",
    width: 0,
    height: 0,
    renderedAt: "",
    themeVersion: 0,
  });
  const kept = diagram("kept");
  const renderForm = () =>
    render(
      <ResourceForm
        resourceKey="projects"
        isNew={false}
        initial={{ ...siteplus, media: [kept, fresh] }}
        options={{}}
      />,
    );
  const save = () =>
    act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Lưu" })),
    );

  // Every control that would add, edit, reorder, render or save, by accessible name.
  const WRITE_CONTROLS = [
    /^Thêm ảnh$/,
    /^Thêm sơ đồ$/,
    /^Sửa hình \d+$/,
    /^Vẽ lại tất cả sơ đồ$/,
    /^Đưa hình \d+ lên$/,
    /^Đưa hình \d+ xuống$/,
    /^Xóa hình \d+$/,
    /^Kéo để sắp xếp /,
    /^Lưu$/,
  ];
  const renderAs = (kind: "admin" | "reviewer") =>
    render(
      <AdminAccessProvider kind={kind}>
        <ResourceForm
          resourceKey="projects"
          isNew={false}
          initial={{ ...siteplus, media: [kept, fresh] }}
          options={{}}
        />
      </AdminAccessProvider>,
    );

  it("the admin form has every figure write control and the real save bar", () => {
    renderAs("admin");
    for (const name of WRITE_CONTROLS)
      expect(
        screen.queryAllByRole("button", { name }).length,
        String(name),
      ).toBeGreaterThan(0);
  });

  it("the reviewer form lists the figures with previews, and has none of those controls", async () => {
    h.saveResource.mockReset();
    h.render.mockReset();
    h.upload.mockReset();
    renderAs("reviewer");
    expect(captions()).toEqual(["kept", "fresh"]);
    expect(
      screen.getByRole("img", { name: "Hình 1" }).getAttribute("src"),
    ).toBe(kept.svgLight);
    for (const name of WRITE_CONTROLS)
      expect(screen.queryAllByRole("button", { name }), String(name)).toEqual(
        [],
      );
    expect(document.getElementById("field-media.1.source")).toBeNull();
    // The save shortcut does nothing either: no render, upload or save action.
    await act(async () => {
      fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    });
    expect(h.render).not.toHaveBeenCalled();
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.saveResource).not.toHaveBeenCalled();
  });

  it("renders and uploads new diagrams, then saves their URLs", async () => {
    h.saveResource.mockReset().mockResolvedValue({ ok: true });
    h.render
      .mockReset()
      .mockImplementation(async (_s: string, theme: string) => ({
        svg: `<svg xmlns="http://www.w3.org/2000/svg"><!--${theme}--></svg>`,
        width: 300,
        height: 120,
      }));
    h.upload
      .mockReset()
      .mockImplementation(async (path: string) => `${PUBLIC}/${path}`);
    renderForm();
    await save();
    await waitFor(() => expect(h.saveResource).toHaveBeenCalledTimes(1));
    // Only the new diagram is rendered: light, then dark.
    expect(h.render.mock.calls.map((c) => c[1])).toEqual(["light", "dark"]);
    const [key, values] = h.saveResource.mock.calls[0];
    expect(key).toBe("projects");
    const media = (values as { media: DiagramFigure[] }).media;
    expect(media[0]).toEqual(kept);
    expect(media[1].svgLight).toMatch(
      /\/diagram\/siteplus-fresh-light-[0-9a-f]{8}\.svg$/,
    );
    expect(media[1]).toMatchObject({
      width: 300,
      height: 120,
      themeVersion: MERMAID_THEME_VERSION,
    });
  });

  it("stops the save and names the figure when its render fails", async () => {
    h.saveResource.mockReset().mockResolvedValue({ ok: true });
    h.toastError.mockReset();
    h.render
      .mockReset()
      .mockRejectedValue(
        new Error("Unsafe SVG: SVG contains a <script> element."),
      );
    h.upload.mockReset();
    renderForm();
    await save();
    await waitFor(() => expect(h.toastError).toHaveBeenCalled());
    expect(h.saveResource).not.toHaveBeenCalled();
    expect(h.upload).not.toHaveBeenCalled();
    const message = String(h.toastError.mock.calls[0][0]);
    expect(message).toContain('Sơ đồ 2 "fresh"');
    expect(message).toMatch(/không an toàn/);
    // The message also sits under the diagram's source, and the form keeps its draft.
    const source = document.getElementById("field-media.1.source");
    expect(source).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByText("Vẽ khi lưu")).toHaveLength(1);
  });
});
