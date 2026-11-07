// Admin only. Renders Mermaid source to a themed, sanitised SVG in the browser.
// Mermaid itself is loaded on first render from public/vendor (see loadMermaid), so
// it is never part of a webpack chunk. Nothing under src/app/[locale] or
// src/components/sections may import this module (the bundle budget would catch it).
import {
  DIAGRAM_FONT_FAMILY,
  mermaidConfig,
  type DiagramTheme,
} from "@/lib/figures/mermaid-theme";
import type { Mermaid } from "mermaid";
import { sanitizeSvg } from "@/lib/admin/sanitize-svg";

export { diagramPath } from "@/lib/figures/mermaid-theme";

export const DIAGRAM_FONT_URL = "/fonts/space-grotesk-a0d054c4.woff2";

export type RenderedDiagram = { svg: string; width: number; height: number };

/** Base64 of a byte buffer, built in chunks so large fonts do not overflow the call stack. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x2000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x2000));
  }
  return btoa(binary);
}

/** Inserts an @font-face with the font as a data URL right after the root <svg> tag. */
export function embedFont(svg: string, fontBase64: string): string {
  const style =
    `<style>@font-face{font-family:"${DIAGRAM_FONT_FAMILY}";font-style:normal;` +
    `font-weight:300 700;src:url(data:font/woff2;base64,${fontBase64}) format("woff2")}</style>`;
  const open = /<svg\b[^>]*>/i.exec(svg);
  if (!open) throw new Error("Mermaid returned no <svg> element.");
  const end = open.index + open[0].length;
  return svg.slice(0, end) + style + svg.slice(end);
}

/** Reads the viewBox size of the root element. */
export function readViewBox(svg: string): { width: number; height: number } {
  const open = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? "";
  const box =
    /\sviewBox\s*=\s*["']\s*([-\d.eE+]+)[\s,]+([-\d.eE+]+)[\s,]+([-\d.eE+]+)[\s,]+([-\d.eE+]+)\s*["']/.exec(
      open,
    );
  const width = box ? Math.ceil(Number(box[3])) : NaN;
  const height = box ? Math.ceil(Number(box[4])) : NaN;
  if (!(width > 0) || !(height > 0)) {
    throw new Error("Mermaid returned an SVG without a usable viewBox.");
  }
  return { width, height };
}

/**
 * Gives the root element absolute width and height (from the viewBox) and drops the
 * responsive max-width style, so the SVG has an intrinsic size when used as an <img>.
 */
export function setIntrinsicSize(svg: string): RenderedDiagram {
  const { width, height } = readViewBox(svg);
  const open = /<svg\b[^>]*>/i.exec(svg);
  if (!open) throw new Error("Mermaid returned no <svg> element.");
  const rest = open[0]
    .slice(4)
    .replace(/\s(?:width|height|style)\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");
  const root = `<svg width="${width}" height="${height}"${rest}`;
  return {
    svg:
      svg.slice(0, open.index) + root + svg.slice(open.index + open[0].length),
    width,
    height,
  };
}

let fontBase64: Promise<string> | null = null;

/** Fetches the font once, registers it for measuring, and returns it as base64. */
function loadFont(): Promise<string> {
  fontBase64 ??= (async () => {
    const res = await fetch(DIAGRAM_FONT_URL);
    if (!res.ok)
      throw new Error(`Could not load the diagram font (${res.status}).`);
    const buffer = await res.arrayBuffer();
    // Mermaid measures text in this document: make sure it uses the same font the SVG embeds.
    const face = new FontFace(DIAGRAM_FONT_FAMILY, buffer.slice(0), {
      weight: "300 700",
    });
    await face.load();
    document.fonts.add(face);
    return bytesToBase64(new Uint8Array(buffer));
  })().catch((error: unknown) => {
    fontBase64 = null;
    throw error;
  });
  return fontBase64;
}

/** Version of public/vendor/mermaid.min.js; a unit test keeps it equal to the package. */
export const MERMAID_VERSION = "12.2.0";
export const MERMAID_SCRIPT_URL = `/vendor/mermaid.min.js?v=${MERMAID_VERSION}`;

let mermaidScript: Promise<Mermaid> | null = null;

/**
 * Loads Mermaid's self-contained build from public/vendor with a classic <script>
 * (the file declares a top-level var and then sets globalThis.mermaid, so it cannot
 * run as a module). It stays outside the webpack graph: bundling it would add lazy
 * chunks, and every lazy chunk adds an entry to the runtime each public page loads.
 */
function loadMermaid(): Promise<Mermaid> {
  mermaidScript ??= new Promise<Mermaid>((resolve, reject) => {
    const loaded = (globalThis as { mermaid?: Mermaid }).mermaid;
    if (loaded) return resolve(loaded);
    const script = document.createElement("script");
    script.src = MERMAID_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const mermaid = (globalThis as { mermaid?: Mermaid }).mermaid;
      if (mermaid) resolve(mermaid);
      else reject(new Error("Mermaid did not load."));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Could not load Mermaid (${MERMAID_SCRIPT_URL}).`));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    mermaidScript = null;
    throw error;
  });
  return mermaidScript;
}

// Mermaid keeps global configuration, so renders run one at a time.
let queue: Promise<unknown> = Promise.resolve();

async function renderNow(
  source: string,
  theme: DiagramTheme,
): Promise<RenderedDiagram> {
  const font = await loadFont();
  const mermaid = await loadMermaid();
  mermaid.initialize(mermaidConfig(theme));
  // A fixed id keeps the output of equal sources equal, so the content hash is stable.
  const id = `figure-diagram-${theme}`;
  try {
    await mermaid.parse(source);
    const { svg } = await mermaid.render(id, source);
    const sized = setIntrinsicSize(svg);
    const clean = sanitizeSvg(embedFont(sized.svg, font));
    return { svg: clean, width: sized.width, height: sized.height };
  } finally {
    // Mermaid can leave its work element in <body> after an error.
    document.getElementById(id)?.remove();
    document.getElementById(`d${id}`)?.remove();
  }
}

/**
 * Renders Mermaid source with the site theme. Needs a real browser (Mermaid measures
 * text), so it has no unit test. The "project figures" scenario in
 * tests/e2e-admin/admin-flows.spec.ts runs it in Chrome against the disposable
 * Supabase stack (CI only): render, Storage upload, the server re-check, the archive.
 */
export function renderDiagram(
  source: string,
  theme: DiagramTheme,
): Promise<RenderedDiagram> {
  const run = queue.then(() => renderNow(source, theme));
  queue = run.catch(() => undefined);
  return run;
}
