import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace, ClampToEdgeWrapping } from "three";
import type { KoiVariety } from "@/content/schema";
import { mulberry32 } from "./random";

export { mulberry32 };

/*
 * Body textures are laid out in the body's uv space: x (u) runs from the snout (0) to the tail tip (1), y (v) goes
 * once around the body: 0 = right side, 0.25 = middle of the back, 0.5 = left side, 0.75 = belly. Layouts are
 * plain data in that 0..1 space (seeded, testable in Node); the draw functions turn them into canvases.
 */

const SEED = 42;
export const BODY_TEX_W = 1024;
export const BODY_TEX_H = 512;

export type PatchTone = "hi" | "sumi";
/** One colour patch: a closed outline as a flat list of [u, v, u, v, ...] in 0..1. */
export type Patch = { tone: PatchTone; color: string; points: number[] };
export type KoiLayout = {
  /** Skin colour on the back and on the belly (a soft vertical gradient between them). */
  base: string;
  belly: string;
  /** Scale outline colour (rgba). */
  scale: string;
  patches: Patch[];
};

type Spec = [cu: number, cv: number, hu: number, hv: number];

/** An organic blob around (cu, cv): an ellipse whose radius wobbles with a few seeded harmonics. */
function blob(rand: () => number, [cu, cv, hu, hv]: Spec, wobble = 1): number[] {
  const k = 36;
  const p1 = rand() * Math.PI * 2;
  const p2 = rand() * Math.PI * 2;
  const p3 = rand() * Math.PI * 2;
  const ju = (rand() - 0.5) * 0.02;
  const jv = (rand() - 0.5) * 0.02;
  const s = 0.92 + rand() * 0.14;
  const pts: number[] = [];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2;
    const f = 1 + wobble * (0.09 * Math.sin(2 * a + p1) + 0.05 * Math.sin(3 * a + p2) + 0.025 * Math.sin(5 * a + p3));
    pts.push(cu + ju + Math.cos(a) * hu * s * f, cv + jv + Math.sin(a) * hv * s * f);
  }
  return pts;
}

const HI = ["#c22c0e", "#cb3511", "#bd270b"];
const SUMI = "#15110e";

/** Patch layout of each variety, seeded with mulberry32(42): the same fish on every visit. */
export function koiPatchLayout(variety: KoiVariety): KoiLayout {
  const rand = mulberry32(SEED);
  const hi = (spec: Spec, i: number): Patch => ({ tone: "hi", color: HI[i % HI.length], points: blob(rand, spec) });
  const sumi = (spec: Spec): Patch => ({ tone: "sumi", color: SUMI, points: blob(rand, spec, 1.3) });

  if (variety === "kohaku") {
    // Classic step pattern: a red head and four patches along the back, clean white belly and tail end.
    const specs: Spec[] = [
      [0.075, 0.25, 0.055, 0.13],
      [0.245, 0.235, 0.085, 0.2],
      [0.425, 0.27, 0.075, 0.21],
      [0.595, 0.23, 0.065, 0.18],
      [0.735, 0.26, 0.04, 0.12],
    ];
    return {
      base: "#ede4d8",
      belly: "#f6f1ea",
      scale: "rgba(120, 96, 78, 0.22)",
      patches: specs.map(hi),
    };
  }
  if (variety === "showa") {
    // Red and white with bold black wraps that run down the flanks.
    const red: Spec[] = [
      [0.08, 0.25, 0.06, 0.14],
      [0.29, 0.22, 0.1, 0.22],
      [0.5, 0.29, 0.095, 0.2],
      [0.69, 0.24, 0.055, 0.15],
    ];
    const black: Spec[] = [
      [0.045, 0.31, 0.03, 0.07],
      [0.18, 0.36, 0.055, 0.27],
      [0.39, 0.11, 0.065, 0.24],
      [0.6, 0.4, 0.075, 0.26],
      [0.8, 0.2, 0.05, 0.2],
      [0.33, 0.62, 0.05, 0.12],
    ];
    return {
      base: "#ece3d7",
      belly: "#f5f0e9",
      scale: "rgba(110, 88, 72, 0.24)",
      patches: [...red.map(hi), ...black.map(sumi)],
    };
  }
  // Ogon: a single metallic gold; the shine comes from the material and the bright scale rims.
  return { base: "#c4831f", belly: "#dfae55", scale: "rgba(255, 226, 150, 0.55)", patches: [] };
}

/** One circuit trace: a polyline in uv space, a `phase` (0..1) that offsets its data pulse, and an end pad. */
export type Trace = { points: number[]; phase: number };

/** Circuit traces running along the body (so the data pulses travel from head to tail). Mostly on the back and flanks. */
export function circuitLayout(): Trace[] {
  const rand = mulberry32(SEED);
  const ROWS = 48;
  const traces: Trace[] = [];
  for (let n = 0; n < 64; n++) {
    // Three quarters of the traces on the upper half (v 0..0.5), the rest underneath.
    const upper = rand() < 0.78;
    let row = upper ? 1 + Math.floor(rand() * (ROWS / 2 - 2)) : ROWS / 2 + 2 + Math.floor(rand() * (ROWS / 2 - 4));
    let u = 0.03 + rand() * 0.78;
    const pts = [u, row / ROWS];
    const segs = 2 + Math.floor(rand() * 3);
    for (let s = 0; s < segs && u < 0.97; s++) {
      u = Math.min(0.97, u + 0.035 + rand() * 0.12);
      pts.push(u, row / ROWS);
      if (s < segs - 1) {
        const step = (rand() < 0.5 ? -1 : 1) * (1 + Math.floor(rand() * 2));
        const next = Math.max(1, Math.min(ROWS - 1, row + step));
        // A 45-degree jog on the body: a v row is about 0.7 of the same distance in u.
        u = Math.min(0.97, u + Math.abs(next - row) * (0.7 / ROWS));
        row = next;
        pts.push(u, row / ROWS);
      }
    }
    traces.push({ points: pts, phase: rand() });
  }
  return traces;
}

// ----------------------------------------------------------------------------------------------- drawing

const canvasCache = new Map<string, HTMLCanvasElement>();

function cachedCanvas(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  let c = canvasCache.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    if (g) draw(g, w, h);
    canvasCache.set(key, c);
  }
  return c;
}

/** Fills a uv-space outline, repeated across the v seam so a patch that wraps around the belly stays whole. */
function fillOutline(g: CanvasRenderingContext2D, pts: number[], w: number, h: number) {
  for (const dv of [-1, 0, 1]) {
    g.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i] * w;
      const y = (pts[i + 1] + dv) * h;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
  }
}

/** Overlapping scale rims, opening towards the head. Scales are drawn wider in u because the body is long. */
function drawScales(g: CanvasRenderingContext2D, w: number, h: number, stroke: string, sx: number, sy: number, lw: number) {
  g.strokeStyle = stroke;
  g.lineWidth = lw;
  for (let row = 0, y = 0; y <= h + sy; row++, y += sy) {
    const off = (row % 2) * (sx / 2);
    for (let x = -sx + off; x <= w + sx; x += sx) {
      g.beginPath();
      g.ellipse(x, y, sx * 0.62, sy * 0.95, 0, -Math.PI / 2 + 0.35, Math.PI / 2 - 0.35);
      g.stroke();
    }
  }
}

function drawKoi(layout: KoiLayout, g: CanvasRenderingContext2D, w: number, h: number) {
  // Back (v 0.25) to belly (v 0.75) gradient, mirrored so both seams match.
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, layout.base);
  grad.addColorStop(0.25, layout.base);
  grad.addColorStop(0.75, layout.belly);
  grad.addColorStop(1, layout.base);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // Soft-edged patches: a slight blur reads as scales overlapping the colour edge.
  g.filter = "blur(1.4px)";
  for (const p of layout.patches) {
    g.fillStyle = p.color;
    fillOutline(g, p.points, w, h);
  }
  g.filter = "none";
  drawScales(g, w, h, layout.scale, 18, 11, 1.3);
}

/** Patterned koi skin (sRGB colour map). The pattern is drawn once per variety and cached. */
export function makeKoiTexture(variety: KoiVariety): CanvasTexture {
  const canvas = cachedCanvas(`koi-${variety}`, BODY_TEX_W, BODY_TEX_H, (g, w, h) => drawKoi(koiPatchLayout(variety), g, w, h));
  return finishColor(new CanvasTexture(canvas));
}

/** Dragon hide: big overlapping scales and pale belly plates, neutral in colour (the material tints it gold). */
export function makeDragonTexture(): CanvasTexture {
  const canvas = cachedCanvas("dragon", BODY_TEX_W, BODY_TEX_H, (g, w, h) => {
    g.fillStyle = "#b99d72";
    g.fillRect(0, 0, w, h);
    const sx = 30;
    const sy = 19;
    for (let row = 0, y = 0; y <= h + sy; row++, y += sy) {
      const off = (row % 2) * (sx / 2);
      for (let x = -sx + off; x <= w + sx; x += sx) {
        const rg = g.createRadialGradient(x - 4, y, 1, x, y, sx * 0.7);
        rg.addColorStop(0, "#fff1d2");
        rg.addColorStop(0.55, "#d9bb87");
        rg.addColorStop(0.85, "#94703f");
        rg.addColorStop(1, "#4a3216");
        g.fillStyle = rg;
        g.beginPath();
        g.ellipse(x, y, sx * 0.62, sy * 0.95, 0, -Math.PI / 2, Math.PI / 2);
        g.lineTo(x - sx * 0.2, y - sy * 0.95);
        g.fill();
      }
    }
    // Belly plates (v 0.64..0.86).
    const top = h * 0.64;
    const bottom = h * 0.86;
    g.fillStyle = "#f0dcae";
    g.fillRect(0, top, w, bottom - top);
    g.strokeStyle = "rgba(90, 60, 26, 0.7)";
    g.lineWidth = 2;
    for (let x = 6; x < w; x += 22) {
      g.beginPath();
      g.moveTo(x, top);
      g.quadraticCurveTo(x + 7, (top + bottom) / 2, x, bottom);
      g.stroke();
    }
    g.strokeRect(-2, top, w + 4, bottom - top);
  });
  return finishColor(new CanvasTexture(canvas));
}

/**
 * Circuit emissive map, packed as data (linear, no colour space): R = trace coverage, G = R * phase, B = R on pads.
 * The body shader reads phase = G / R to send a pulse of light along each trace at its own time.
 */
export function makeCircuitTexture(): CanvasTexture {
  const canvas = cachedCanvas("circuit", BODY_TEX_W, BODY_TEX_H, (g, w, h) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    g.lineCap = "round";
    g.lineJoin = "round";
    for (const { points, phase } of circuitLayout()) {
      const p = Math.round(phase * 255);
      g.strokeStyle = `rgb(255, ${p}, 0)`;
      g.lineWidth = 4.2;
      g.beginPath();
      for (let i = 0; i < points.length; i += 2) {
        const x = points[i] * w;
        const y = points[i + 1] * h;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = `rgb(255, ${p}, 255)`;
      const ex = points[points.length - 2] * w;
      const ey = points[points.length - 1] * h;
      g.beginPath();
      g.arc(ex, ey, 6.5, 0, Math.PI * 2);
      g.fill();
      // A via ring at the start.
      g.strokeStyle = `rgb(255, ${p}, 255)`;
      g.lineWidth = 2.4;
      g.beginPath();
      g.arc(points[0] * w, points[1] * h, 5, 0, Math.PI * 2);
      g.stroke();
    }
  });
  const t = new CanvasTexture(canvas);
  t.flipY = false;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = NoColorSpace;
  return t;
}

/** Scale relief for the bump map (grey, shared by every variety). */
export function makeScaleBumpTexture(): CanvasTexture {
  const canvas = cachedCanvas("bump", 512, 256, (g, w, h) => {
    g.fillStyle = "#808080";
    g.fillRect(0, 0, w, h);
    const sx = 9;
    const sy = 5.5;
    for (let row = 0, y = 0; y <= h + sy; row++, y += sy) {
      const off = (row % 2) * (sx / 2);
      for (let x = -sx + off; x <= w + sx; x += sx) {
        const rg = g.createRadialGradient(x - sx * 0.3, y, 0.5, x, y, sx * 0.7);
        rg.addColorStop(0, "#b8b8b8");
        rg.addColorStop(1, "#5a5a5a");
        g.fillStyle = rg;
        g.beginPath();
        g.ellipse(x, y, sx * 0.62, sy * 0.95, 0, -Math.PI / 2, Math.PI / 2);
        g.lineTo(x - sx * 0.25, y - sy * 0.95);
        g.fill();
      }
    }
  });
  const t = new CanvasTexture(canvas);
  t.flipY = false;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = NoColorSpace;
  return t;
}

/**
 * Fin membrane in fin space: x runs from the fin base (0) to its edge (1), y across the fin. Opaque near the body,
 * glassy towards the edge, with fine rays. Showa fins get their black base (motoguro).
 */
export function makeFinTexture(variety: KoiVariety): CanvasTexture {
  const canvas = cachedCanvas(`fin-${variety}`, 256, 128, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    grad.addColorStop(0.55, "rgba(255, 255, 255, 0.62)");
    grad.addColorStop(0.9, "rgba(255, 255, 255, 0.3)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0.45)");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    if (variety === "showa") {
      const sumi = g.createLinearGradient(0, 0, w * 0.45, 0);
      sumi.addColorStop(0, "rgba(21, 17, 14, 0.95)");
      sumi.addColorStop(0.7, "rgba(21, 17, 14, 0.85)");
      sumi.addColorStop(1, "rgba(21, 17, 14, 0)");
      g.fillStyle = sumi;
      g.fillRect(0, 0, w * 0.45, h);
    }
    // Rays: darker hairlines that fork slightly towards the edge.
    g.strokeStyle = variety === "showa" ? "rgba(60, 50, 44, 0.5)" : "rgba(170, 140, 110, 0.5)";
    g.lineWidth = 1.2;
    for (let y = 4; y < h; y += 8) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w * 0.6, y);
      g.lineTo(w, y - 2);
      g.moveTo(w * 0.6, y);
      g.lineTo(w, y + 2);
      g.stroke();
    }
  });
  const t = new CanvasTexture(canvas);
  t.flipY = false;
  t.wrapS = ClampToEdgeWrapping;
  t.wrapT = ClampToEdgeWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

function finishColor(t: CanvasTexture): CanvasTexture {
  t.flipY = false;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Fin glow (emissive): faint rays and a bright rim, so the fins carry the circuit's orange light. */
export function makeFinGlowTexture(): CanvasTexture {
  const canvas = cachedCanvas("fin-glow", 256, 128, (g, w, h) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(255, 255, 255, 0.28)";
    g.lineWidth = 1.2;
    for (let y = 4; y < h; y += 8) {
      g.beginPath();
      g.moveTo(w * 0.15, y);
      g.lineTo(w, y);
      g.stroke();
    }
    const rim = g.createLinearGradient(w * 0.86, 0, w, 0);
    rim.addColorStop(0, "rgba(255, 255, 255, 0)");
    rim.addColorStop(1, "rgba(255, 255, 255, 1)");
    g.fillStyle = rim;
    g.fillRect(w * 0.86, 0, w * 0.14, h);
  });
  const t = new CanvasTexture(canvas);
  t.flipY = false;
  t.wrapS = ClampToEdgeWrapping;
  t.wrapT = ClampToEdgeWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}
