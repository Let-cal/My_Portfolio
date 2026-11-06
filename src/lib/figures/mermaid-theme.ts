import type { MermaidConfig } from "mermaid";

// Type-only import above: this module never loads Mermaid itself, so the tests,
// the server and the browser can all read the theme without pulling the library in.

/**
 * Version of the diagram theme below. Changing any colour, the font or the
 * Mermaid options bumps it; the admin then flags diagrams rendered with an
 * older version so they can be re-rendered.
 */
export const MERMAID_THEME_VERSION = 1;

export type DiagramTheme = "light" | "dark";

export const DIAGRAM_FONT_FAMILY = "Space Grotesk";

// Literal values copied from the site tokens in src/app/globals.css. An SVG served
// through <img> cannot read CSS variables, so the colours are baked in.
// The border tokens are alpha colours on the page; they are flattened here onto the
// card colour so the node outline stays readable in a standalone SVG.
const TOKENS = {
  dark: {
    fg: "#f4f4f5",
    muted: "#a1a1aa",
    card: "#141416",
    mutedSurface: "#1f1f23",
    border: "#2c2c2d",
  },
  light: {
    fg: "#18181b",
    muted: "#484850",
    card: "#ffffff",
    mutedSurface: "#f1f1ef",
    border: "#e6e6e6",
  },
} as const;

// Koi orange (--brand-500, #f97316) at 70%.
const LINE = "rgba(249, 115, 22, 0.7)";

export function mermaidConfig(theme: DiagramTheme): MermaidConfig {
  const t = TOKENS[theme];
  return {
    startOnLoad: false,
    // Mermaid sanitises labels itself in strict mode; the result is still passed
    // through DOMPurify and isSafeSvg before it is stored.
    securityLevel: "strict",
    theme: "base",
    // SVG <text> labels: measured and drawn with the embedded font, no HTML needed.
    htmlLabels: false,
    fontFamily: DIAGRAM_FONT_FAMILY,
    flowchart: { useMaxWidth: false },
    sequence: { useMaxWidth: false },
    er: { useMaxWidth: false },
    class: { useMaxWidth: false },
    state: { useMaxWidth: false },
    themeVariables: {
      darkMode: theme === "dark",
      background: "transparent",
      fontFamily: `"${DIAGRAM_FONT_FAMILY}", sans-serif`,
      fontSize: "16px",
      // Nodes: card fill, border token, foreground text.
      primaryColor: t.card,
      primaryTextColor: t.fg,
      primaryBorderColor: t.border,
      secondaryColor: t.mutedSurface,
      secondaryTextColor: t.fg,
      secondaryBorderColor: t.border,
      tertiaryColor: t.mutedSurface,
      tertiaryTextColor: t.fg,
      tertiaryBorderColor: t.border,
      mainBkg: t.card,
      nodeBorder: t.border,
      nodeTextColor: t.fg,
      textColor: t.fg,
      titleColor: t.fg,
      // Lines and arrows: koi orange at 70%.
      lineColor: LINE,
      // Groups, labels and notes.
      clusterBkg: t.mutedSurface,
      clusterBorder: t.border,
      edgeLabelBackground: t.card,
      noteBkgColor: t.mutedSurface,
      noteTextColor: t.fg,
      noteBorderColor: t.border,
      // Sequence diagrams.
      actorBkg: t.card,
      actorBorder: t.border,
      actorTextColor: t.fg,
      actorLineColor: t.muted,
      signalColor: LINE,
      signalTextColor: t.fg,
      labelBoxBkgColor: t.card,
      labelBoxBorderColor: t.border,
      labelTextColor: t.fg,
      loopTextColor: t.fg,
      activationBkgColor: t.mutedSurface,
      activationBorderColor: t.border,
      // ER diagrams: attribute rows alternate card / muted surface.
      attributeBackgroundColorOdd: t.card,
      attributeBackgroundColorEven: t.mutedSurface,
      // Mermaid 12 reads the row colours of ER tables from rowOdd / rowEven.
      rowOdd: t.card,
      rowEven: t.mutedSurface,
    },
  };
}

// SHA-256 in plain TypeScript: diagramPath is synchronous and runs in the browser
// and on the server, where crypto.subtle (async) and node:crypto are not both usable.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 2 ** 32));
  view.setUint32(padded.length - 4, bitLength >>> 0);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  return Array.from(h, (n) => n.toString(16).padStart(8, "0")).join("");
}

/**
 * Storage path of a rendered diagram, relative to the "media" bucket:
 * diagram/<project>-<figure>-<light|dark>-<hash8>.svg. The hash (first 8 hex of the
 * SHA-256 of the SVG text) changes whenever the picture does, so a re-render never
 * overwrites a file a published page may still point at.
 */
export function diagramPath(
  projectId: string,
  figureId: string,
  theme: DiagramTheme,
  svg: string,
): string {
  return `diagram/${projectId}-${figureId}-${theme}-${sha256Hex(svg).slice(0, 8)}.svg`;
}
