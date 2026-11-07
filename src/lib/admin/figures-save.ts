// Figure save pipeline. Plain module: the project form (browser) renders and uploads
// diagrams with prepareFigures before it calls the save action; the save action
// (server) re-checks every figure URL and diagram body with assertFiguresSafe.
// Nothing here loads Mermaid or DOMPurify: the renderer and the uploader are passed in.
import { z } from "zod";
import {
  diagramFigureSchema,
  imageFigureSchema,
  MAX_DIAGRAM_SOURCE,
  type DiagramFigure,
  type Figure,
} from "@/content/schema";
import type { renderDiagram } from "@/lib/admin/render-diagram";
import {
  diagramPath,
  MERMAID_THEME_VERSION,
  type DiagramTheme,
} from "@/lib/figures/mermaid-theme";
import { isSafeSvg, SVG_MAX_BYTES } from "@/lib/figures/svg-safety";

/**
 * A figure as the form holds it: a diagram that was never rendered has no SVG URLs,
 * size or render time yet (prepareFigures fills them in on save). Its source is required.
 */
export const figureDraftSchema = z.discriminatedUnion("kind", [
  imageFigureSchema,
  diagramFigureSchema.extend({
    source: z
      .string()
      .max(MAX_DIAGRAM_SOURCE)
      .refine((s) => s.trim() !== "", "Diagram source is required"),
    svgLight: z.string(),
    svgDark: z.string(),
    width: z.number().int().nonnegative(),
    height: z.number().int().nonnegative(),
    renderedAt: z.string(),
  }),
]);

export type RenderFn = typeof renderDiagram;
export type PrepareDeps = {
  render: RenderFn;
  /** Uploads one SVG to the media bucket at `path` and returns its public URL. */
  upload(path: string, svg: string): Promise<string>;
};
export type PrepareResult =
  | { ok: true; media: Figure[] }
  | { ok: false; figureId: string; message: string };

/** Whether a diagram must be rendered again before the project is saved. */
export function needsRender(
  figure: DiagramFigure,
  previous: DiagramFigure | undefined,
): boolean {
  return (
    !previous ||
    previous.source !== figure.source ||
    !figure.svgLight ||
    !figure.svgDark ||
    figure.themeVersion < MERMAID_THEME_VERSION
  );
}

/** "Hinh 2 (Caption)" in Vietnamese, for messages that must name the figure. */
export function figureLabel(figure: Figure, index: number): string {
  const caption = (figure.caption.vi || figure.caption.en || "").trim();
  const kind = figure.kind === "diagram" ? "Sơ đồ" : "Ảnh";
  return caption
    ? `${kind} ${index + 1} "${caption}"`
    : `${kind} ${index + 1} (${figure.id})`;
}

const firstLine = (message: string) => message.split("\n")[0].slice(0, 300);

/**
 * A render error as text an editor can act on: Mermaid's parser message (with its line
 * pointer) is kept, stack frames are dropped, and a sanitiser refusal is explained.
 */
export function describeRenderError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lines = raw
    .split("\n")
    .filter((line) => !/^\s+at\s/.test(line))
    .slice(0, 6);
  const message = lines.join("\n").trim().slice(0, 600);
  if (/^Unsafe SVG/i.test(message)) {
    return (
      "kết quả vẽ có nội dung không an toàn (thường do nhãn chứa mã như <script> " +
      "hoặc liên kết ngoài). Sửa nhãn trong mã Mermaid rồi lưu lại."
    );
  }
  if (/parse error|syntax error|lexical error|no diagram type/i.test(message)) {
    return `lỗi cú pháp Mermaid: ${message}`;
  }
  return `không vẽ được: ${firstLine(message) || "lỗi không rõ"}`;
}

/**
 * Renders (light and dark) every diagram that needs it, then uploads the renderings and
 * returns the media with their URLs. All renders run before any upload, so a render
 * failure uploads nothing; any failure stops at that figure and returns no media.
 */
export async function prepareFigures(
  projectId: string,
  next: Figure[],
  previous: Figure[],
  deps: PrepareDeps,
): Promise<PrepareResult> {
  const before = new Map(
    previous
      .filter((f): f is DiagramFigure => f.kind === "diagram")
      .map((f) => [f.id, f]),
  );
  type Job = {
    index: number;
    figure: DiagramFigure;
    svg: Record<DiagramTheme, string>;
    width: number;
    height: number;
  };
  const jobs: Job[] = [];
  for (const [index, figure] of next.entries()) {
    if (
      figure.kind !== "diagram" ||
      !needsRender(figure, before.get(figure.id))
    )
      continue;
    try {
      const light = await deps.render(figure.source, "light");
      const dark = await deps.render(figure.source, "dark");
      jobs.push({
        index,
        figure,
        svg: { light: light.svg, dark: dark.svg },
        width: light.width,
        height: light.height,
      });
    } catch (error) {
      return {
        ok: false,
        figureId: figure.id,
        message: `${figureLabel(figure, index)}: ${describeRenderError(error)}`,
      };
    }
  }

  const media = [...next];
  const renderedAt = new Date().toISOString();
  for (const job of jobs) {
    const urls: Partial<Record<DiagramTheme, string>> = {};
    for (const theme of ["light", "dark"] as const) {
      const svg = job.svg[theme];
      try {
        urls[theme] = await deps.upload(
          diagramPath(projectId, job.figure.id, theme, svg),
          svg,
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          figureId: job.figure.id,
          message: `${figureLabel(job.figure, job.index)}: không tải được bản vẽ lên (${firstLine(reason)}).`,
        };
      }
    }
    media[job.index] = {
      ...job.figure,
      svgLight: urls.light!,
      svgDark: urls.dark!,
      width: job.width,
      height: job.height,
      renderedAt,
      themeVersion: MERMAID_THEME_VERSION,
    };
  }
  return { ok: true, media };
}

const SVG_TYPE = /^image\/svg\+xml(?:;charset=utf-8)?$/;

/**
 * Fetches a diagram SVG for the server-side check. The body is decoded exactly as a
 * browser decodes an image/svg+xml; charset=utf-8 response: UTF-8 via TextDecoder
 * (a leading BOM is dropped). Invalid UTF-8, another content type or charset, a
 * redirect and a body over 1 MB are refused.
 */
export async function fetchSvgText(url: string): Promise<string> {
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = (res.headers.get("content-type") ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!SVG_TYPE.test(type)) {
    throw new Error(`unexpected content type "${type || "none"}"`);
  }
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > SVG_MAX_BYTES) throw new Error("SVG is larger than 1 MB.");
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > SVG_MAX_BYTES)
    throw new Error("SVG is larger than 1 MB.");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("SVG is not valid UTF-8.");
  }
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Server trust boundary for a project's figures. Every image must be an uploaded file
 * under media/image/ and every diagram rendering a file under media/diagram/ named as
 * diagramPath names it; each diagram body is fetched and must pass isSafeSvg.
 */
export async function assertFiguresSafe(
  media: Figure[],
  fetchSvg: (url: string) => Promise<string>,
  supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
): Promise<{ ok: true } | { ok: false; figureId: string; message: string }> {
  if (media.length === 0) return { ok: true };
  const base = supabaseUrl.replace(/\/+$/, "");
  const root = base
    ? `^${escapeRegExp(base)}/storage/v1/object/public/media/`
    : null;
  const imageUrl = root
    ? new RegExp(`${root}image/[a-z0-9-]+(?:\\.[a-z0-9]+)?$`)
    : null;
  const diagramUrl = root
    ? new RegExp(`${root}diagram/[a-z0-9-]+-(?:light|dark)-[0-9a-f]{8}\\.svg$`)
    : null;
  const fail = (figure: Figure, index: number, reason: string) => ({
    ok: false as const,
    figureId: figure.id,
    message: `${figureLabel(figure, index)} không an toàn: ${reason}`,
  });

  for (const [index, figure] of media.entries()) {
    if (figure.kind === "image") {
      if (!imageUrl?.test(figure.url))
        return fail(figure, index, "ảnh phải là tệp đã tải lên thư viện.");
    } else if (
      !diagramUrl?.test(figure.svgLight) ||
      !diagramUrl.test(figure.svgDark)
    ) {
      return fail(
        figure,
        index,
        "bản vẽ phải nằm trong thư mục diagram của thư viện.",
      );
    }
  }

  const checks = media.map(async (figure, index) => {
    if (figure.kind !== "diagram") return null;
    for (const url of [figure.svgLight, figure.svgDark]) {
      let svg: string;
      try {
        svg = await fetchSvg(url);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return fail(
          figure,
          index,
          `không đọc được bản vẽ (${firstLine(reason)}).`,
        );
      }
      const check = isSafeSvg(svg);
      if (!check.ok) return fail(figure, index, check.reason);
    }
    return null;
  });
  for (const result of await Promise.all(checks)) if (result) return result;
  return { ok: true };
}
