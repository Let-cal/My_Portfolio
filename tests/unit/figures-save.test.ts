import { afterEach, describe, expect, it, vi } from "vitest";
import type { DiagramFigure, Figure, ImageFigure } from "@/content/schema";
import {
  assertFiguresSafe,
  describeRenderError,
  fetchSvgText,
  needsRender,
  prepareFigures,
} from "@/lib/admin/figures-save";
import { MERMAID_THEME_VERSION } from "@/lib/figures/mermaid-theme";

const BASE = "https://proj.supabase.co";
const PUBLIC = `${BASE}/storage/v1/object/public/media`;
const SAFE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

const text = (en: string) => ({ en, ja: "", vi: "" });

function diagram(
  id: string,
  patch: Partial<DiagramFigure> = {},
): DiagramFigure {
  return {
    id,
    kind: "diagram",
    category: "architecture",
    caption: text(`Caption ${id}`),
    note: { en: "" },
    alt: text(`Alt ${id}`),
    source: `flowchart LR\n  ${id} --> B`,
    svgLight: `${PUBLIC}/diagram/p-${id}-light-0000000a.svg`,
    svgDark: `${PUBLIC}/diagram/p-${id}-dark-0000000b.svg`,
    width: 100,
    height: 40,
    renderedAt: "2026-10-31T00:00:00.000Z",
    themeVersion: MERMAID_THEME_VERSION,
    ...patch,
  };
}

function image(id: string, patch: Partial<ImageFigure> = {}): ImageFigure {
  return {
    id,
    kind: "image",
    category: "screen",
    caption: text(`Caption ${id}`),
    note: { en: "" },
    alt: text(`Alt ${id}`),
    url: `${PUBLIC}/image/abc12345-shot.png`,
    width: 800,
    height: 600,
    ...patch,
  };
}

const rendered = (source: string, theme: string) => ({
  svg: `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${theme} ${source} --></svg>`,
  width: 120,
  height: 60,
});

describe("needsRender", () => {
  it("is false for an unchanged, current diagram", () => {
    expect(needsRender(diagram("a"), diagram("a"))).toBe(false);
  });
  it("is true when the source changed, the URLs are missing or the theme is older", () => {
    expect(needsRender(diagram("a", { source: "x" }), diagram("a"))).toBe(true);
    expect(needsRender(diagram("a", { svgDark: "" }), diagram("a"))).toBe(true);
    expect(
      needsRender(
        diagram("a", { themeVersion: MERMAID_THEME_VERSION - 1 }),
        diagram("a"),
      ),
    ).toBe(true);
    expect(needsRender(diagram("a"), undefined)).toBe(true);
  });
});

describe("prepareFigures", () => {
  it("renders only diagrams whose source or theme changed", async () => {
    const render = vi.fn(async (s: string, t: "light" | "dark") =>
      rendered(s, t),
    );
    const upload = vi.fn(async (path: string) => `${PUBLIC}/${path}`);
    const previous: Figure[] = [diagram("same"), diagram("edited"), image("i")];
    const next: Figure[] = [
      diagram("same"),
      diagram("edited", { source: "flowchart TD\n  X --> Y" }),
      diagram("old", { themeVersion: 0 }),
      image("i"),
    ];
    const result = await prepareFigures("p", next, previous, {
      render,
      upload,
    });
    expect(result.ok).toBe(true);
    expect(
      render.mock.calls.map(([s, t]) => `${s.split("\n")[1]}|${t}`),
    ).toEqual([
      "  X --> Y|light",
      "  X --> Y|dark",
      "  old --> B|light",
      "  old --> B|dark",
    ]);
    if (result.ok) {
      expect(result.media[0]).toEqual(next[0]);
      expect(result.media[3]).toEqual(next[3]);
    }
  });

  it("uploads light and dark and writes their URLs, size and themeVersion", async () => {
    const render = vi.fn(async (s: string, t: "light" | "dark") =>
      rendered(s, t),
    );
    const upload = vi.fn<(path: string, svg: string) => Promise<string>>(
      async (path) => `${PUBLIC}/${path}`,
    );
    const fresh = diagram("new-one", {
      svgLight: "",
      svgDark: "",
      width: 0,
      height: 0,
      renderedAt: "",
      themeVersion: 0,
    });
    const result = await prepareFigures("proj", [fresh], [], {
      render,
      upload,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [out] = result.media as DiagramFigure[];
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[0][0]).toMatch(
      /^diagram\/proj-new-one-light-[0-9a-f]{8}\.svg$/,
    );
    expect(upload.mock.calls[1][0]).toMatch(
      /^diagram\/proj-new-one-dark-[0-9a-f]{8}\.svg$/,
    );
    expect(upload.mock.calls[0][1]).toContain("light");
    expect(out.svgLight).toBe(`${PUBLIC}/${upload.mock.calls[0][0]}`);
    expect(out.svgDark).toBe(`${PUBLIC}/${upload.mock.calls[1][0]}`);
    expect(out).toMatchObject({
      width: 120,
      height: 60,
      themeVersion: MERMAID_THEME_VERSION,
      source: fresh.source,
    });
    expect(Number.isNaN(Date.parse(out.renderedAt))).toBe(false);
    // The input is never changed in place.
    expect(fresh.svgLight).toBe("");
  });

  it("save stops and writes nothing when the second diagram fails", async () => {
    const render = vi.fn(async (s: string, t: "light" | "dark") => {
      if (s.includes("broken")) throw new Error("Parse error on line 2:\n...");
      return rendered(s, t);
    });
    const upload = vi.fn(async (path: string) => `${PUBLIC}/${path}`);
    const next: Figure[] = [
      diagram("first", { themeVersion: 0 }),
      diagram("second", { source: "flowchart LR\n  broken -->" }),
      diagram("third", { themeVersion: 0 }),
    ];
    const result = await prepareFigures("p", next, [], { render, upload });
    expect(result).toMatchObject({ ok: false, figureId: "second" });
    expect(result).not.toHaveProperty("media");
    if (!result.ok) {
      expect(result.message).toContain("Caption second");
      expect(result.message).toContain("Parse error on line 2");
    }
    // Rendering happens before any upload, so nothing reaches storage.
    expect(upload).not.toHaveBeenCalled();
    expect(render.mock.calls.some(([s]) => s.includes("third"))).toBe(false);
  });

  it("stops at the first failed upload and names that figure", async () => {
    const render = vi.fn(async (s: string, t: "light" | "dark") =>
      rendered(s, t),
    );
    const upload = vi.fn(async (path: string) => {
      if (path.includes("-b-dark-")) throw new Error("Bucket not found");
      return `${PUBLIC}/${path}`;
    });
    const next: Figure[] = [
      diagram("a", { themeVersion: 0 }),
      diagram("b", { themeVersion: 0 }),
      diagram("c", { themeVersion: 0 }),
    ];
    const result = await prepareFigures("p", next, [], { render, upload });
    expect(result).toMatchObject({ ok: false, figureId: "b" });
    if (!result.ok) expect(result.message).toContain("Bucket not found");
    expect(upload.mock.calls.some(([p]) => p.includes("-c-"))).toBe(false);
  });

  it("explains an unsafe rendering in Vietnamese, without a stack", async () => {
    const error = new Error("Unsafe SVG: SVG contains a <script> element.");
    error.stack = "Error: Unsafe SVG\n    at sanitizeSvg (x.ts:1:1)";
    const result = await prepareFigures(
      "p",
      [diagram("x", { themeVersion: 0 })],
      [],
      {
        render: async () => {
          throw error;
        },
        upload: async (p) => p,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/không an toàn/);
      expect(result.message).toContain("Caption x");
      expect(result.message).not.toContain(" at ");
    }
  });
});

describe("describeRenderError", () => {
  it("keeps the parser message and drops stack lines", () => {
    const error = new Error(
      "Parse error on line 2:\n...A-->\n-----^\nExpecting 'NODE_STRING', got 'EOF'",
    );
    error.stack = `${error.message}\n    at parse (mermaid.js:1:1)`;
    const out = describeRenderError(error);
    expect(out).toContain("Parse error on line 2");
    expect(out).toContain("Expecting 'NODE_STRING'");
    expect(out).not.toContain("mermaid.js");
  });
});

describe("assertFiguresSafe", () => {
  const fetchOk = vi.fn(async () => SAFE_SVG);

  it("accepts storage URLs whose SVG passes the check", async () => {
    expect(
      await assertFiguresSafe([diagram("a"), image("i")], fetchOk, BASE),
    ).toEqual({ ok: true });
    expect(fetchOk).toHaveBeenCalledTimes(2);
  });

  it("assertFiguresSafe rejects a URL outside the bucket", async () => {
    const outside = [
      "https://evil.example/storage/v1/object/public/media/diagram/p-a-light-0000000a.svg",
      `${BASE}/storage/v1/object/public/files/diagram/p-a-light-0000000a.svg`,
      `${PUBLIC}/image/p-a-light-0000000a.svg`,
      `${PUBLIC}/diagram/../image/p-a-light-0000000a.svg`,
      `${PUBLIC}/diagram/%2e%2e/p-a-light-0000000a.svg`,
      `${PUBLIC}/diagram/p-a-light-0000000a.svg?x=1`,
      "/seed/figures/seed-diagram-light.svg",
    ];
    for (const url of outside) {
      const fetchSvg = vi.fn(async () => SAFE_SVG);
      const result = await assertFiguresSafe(
        [diagram("a", { svgLight: url })],
        fetchSvg,
        BASE,
      );
      expect(result.ok, url).toBe(false);
      expect(fetchSvg).not.toHaveBeenCalledWith(url);
    }
    for (const url of [
      `${PUBLIC}/diagram/p-a-light-0000000a.svg`,
      "/images/shot.png",
      `${BASE}/storage/v1/object/public/files/image/abc-shot.png`,
      `${PUBLIC}/image/../diagram/x.svg`,
    ]) {
      const result = await assertFiguresSafe(
        [image("i", { url })],
        fetchOk,
        BASE,
      );
      expect(result.ok, url).toBe(false);
    }
  });

  it("assertFiguresSafe rejects an SVG with a script", async () => {
    const result = await assertFiguresSafe(
      [diagram("a")],
      async () =>
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      BASE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.figureId).toBe("a");
      expect(result.message).toContain("Caption a");
    }
  });

  it("rejects when the SVG cannot be fetched", async () => {
    const result = await assertFiguresSafe(
      [diagram("a")],
      async () => {
        throw new Error("HTTP 404");
      },
      BASE,
    );
    expect(result).toMatchObject({ ok: false, figureId: "a" });
  });

  it("rejects every figure when the storage URL is not configured", async () => {
    expect((await assertFiguresSafe([image("i")], fetchOk, "")).ok).toBe(false);
    expect(await assertFiguresSafe([], fetchOk, "")).toEqual({ ok: true });
  });
});

describe("fetchSvgText", () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (body: BodyInit, type: string | null, status = 200) => {
    const headers = new Headers();
    if (type !== null) headers.set("content-type", type);
    const fetchMock = vi.fn<
      (url: string, init?: RequestInit) => Promise<Response>
    >(async () => new Response(body, { status, headers }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  it("decodes the bytes as UTF-8 with TextDecoder (BOM dropped, multi-byte kept)", async () => {
    const bytes = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...new TextEncoder().encode('<svg xmlns="x"><text>図 ✓</text></svg>'),
    ]);
    respond(bytes, "image/svg+xml; charset=utf-8");
    // Buffer.toString would keep the BOM as U+FEFF; TextDecoder drops it, as browsers do.
    expect(await fetchSvgText("https://x/a.svg")).toBe(
      '<svg xmlns="x"><text>図 ✓</text></svg>',
    );
  });

  it("refuses bytes that are not valid UTF-8, where Buffer.toString would substitute U+FFFD", async () => {
    respond(
      new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0xff, 0x3e]),
      "image/svg+xml",
    );
    await expect(fetchSvgText("https://x/a.svg")).rejects.toThrow(/UTF-8/);
    respond(new Uint8Array([0xff, 0xfe, 0x3c, 0x00]), "image/svg+xml");
    await expect(fetchSvgText("https://x/a.svg")).rejects.toThrow(/UTF-8/);
  });

  it("requires image/svg+xml, optionally with charset=utf-8 only", async () => {
    for (const ok of [
      "image/svg+xml",
      "image/svg+xml; charset=utf-8",
      "IMAGE/SVG+XML;charset=UTF-8",
    ]) {
      respond(SAFE_SVG, ok);
      expect(await fetchSvgText("https://x/a.svg")).toBe(SAFE_SVG);
    }
    for (const bad of [
      null,
      "text/html",
      "image/svg+xml; charset=iso-8859-1",
      "image/svg+xml; charset=utf-16",
      "image/svg+xml; charset=utf-8; x=y",
      "application/xml",
    ]) {
      respond(SAFE_SVG, bad);
      await expect(fetchSvgText("https://x/a.svg")).rejects.toThrow(
        /content type/i,
      );
    }
  });

  it("refuses a failed response, a redirect and a body over 1 MB", async () => {
    respond("nope", "image/svg+xml", 404);
    await expect(fetchSvgText("https://x/a.svg")).rejects.toThrow(/404/);
    const fetchMock = respond(SAFE_SVG, "image/svg+xml");
    await fetchSvgText("https://x/a.svg");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "error" });
    respond("a".repeat(1024 * 1024 + 1), "image/svg+xml");
    await expect(fetchSvgText("https://x/a.svg")).rejects.toThrow(/1 MB/);
  });
});
