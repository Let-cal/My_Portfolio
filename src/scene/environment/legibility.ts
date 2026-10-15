/** A screen-space rectangle in CSS pixels, y down, relative to the viewport. */
export type Rect = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Large text (24px, or 19px bold, and up): readable at a lower contrast, so by day it needs no veil of its own. */
  large?: boolean;
  /** An opaque card still excludes the creature, but needs no additional DOM backdrop. */
  veil?: boolean;
};

/** The most blocks of text protected at once (one element each in the veil layer). */
export const MAX_AVOID = 24;

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/**
 * How much text-protection covers the point (x, y): 1 inside a rectangle, falling smoothly to 0 over `feather`
 * pixels outside it. The strongest rectangle wins. The same falloff the veil shader draws.
 */
export function rectCoverage(rects: readonly Rect[], x: number, y: number, feather: number): number {
  let best = 0;
  for (const r of rects) {
    const dx = Math.max(r.x0 - x, 0, x - r.x1);
    const dy = Math.max(r.y0 - y, 0, y - r.y1);
    const d = Math.hypot(dx, dy);
    const c = d <= 0 ? 1 : 1 - smooth(d / feather);
    if (c > best) best = c;
  }
  return best;
}

/**
 * How visible the creature should be: 1 when no sample point of its body is under text, `floor` when all of them
 * are, and the average in between (so a tail under a heading dims it a little, not completely).
 */
export function creatureVisibility(
  rects: readonly Rect[],
  points: readonly { x: number; y: number }[],
  feather: number,
  floor: number,
): number {
  if (rects.length === 0 || points.length === 0) return 1;
  let sum = 0;
  let worst = 0;
  for (const p of points) {
    const c = rectCoverage(rects, p.x, p.y, feather);
    sum += c;
    if (c > worst) worst = c;
  }
  const covered = 0.35 * (sum / points.length) + 0.65 * worst;
  return 1 - (1 - floor) * covered;
}

/**
 * Joins nearby compact rectangles with the same backdrop policy. Rows of chips can share protection, while an
 * offset pair must not fill an empty courtyard. A new array: the input is left alone.
 */
export function mergeRects(rects: readonly Rect[], gap: number): Rect[] {
  const out: Rect[] = rects.map((r) => ({ ...r }));
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < out.length && !merged; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        const unionArea = (Math.max(a.x1, b.x1) - Math.min(a.x0, b.x0)) * (Math.max(a.y1, b.y1) - Math.min(a.y0, b.y0));
        const overlap = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
        const filledArea = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - overlap;
        // A shared backdrop must not turn an L-shaped pair into a large empty panel.
        const compact = filledArea >= unionArea * 0.75;
        if ((a.veil !== false) === (b.veil !== false) && compact && b.x0 - a.x1 <= gap && a.x0 - b.x1 <= gap && b.y0 - a.y1 <= gap && a.y0 - b.y1 <= gap) {
          a.x0 = Math.min(a.x0, b.x0);
          a.y0 = Math.min(a.y0, b.y0);
          a.x1 = Math.max(a.x1, b.x1);
          a.y1 = Math.max(a.y1, b.y1);
          if (a.large !== undefined || b.large !== undefined) a.large = a.large === true && b.large === true;
          out.splice(j, 1);
          merged = true;
          break;
        }
      }
    }
  }
  return out;
}

/**
 * The rectangles worth drawing: clipped to the viewport, empty and off-screen ones dropped, and at most
 * `MAX_AVOID` of them, the biggest first.
 */
export function selectRects(rects: readonly Rect[], width: number, height: number, max = MAX_AVOID): Rect[] {
  const kept: Rect[] = [];
  for (const r of rects) {
    const x0 = Math.max(0, r.x0);
    const y0 = Math.max(0, r.y0);
    const x1 = Math.min(width, r.x1);
    const y1 = Math.min(height, r.y1);
    if (x1 - x0 > 0 && y1 - y0 > 0) kept.push({ x0, y0, x1, y1, large: r.large, ...(r.veil === false ? { veil: false } : {}) });
  }
  kept.sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0));
  return kept.length > max ? kept.slice(0, max) : kept;
}

/** True when the rectangles overlap or are within `margin` pixels of each other. */
export function rectsNear(a: Rect, b: Rect, margin: number): boolean {
  return b.x0 - a.x1 <= margin && a.x0 - b.x1 <= margin && b.y0 - a.y1 <= margin && a.y0 - b.y1 <= margin;
}

/**
 * How strongly the veil behind a block of text is drawn, `floor` to 1. A calm, dark night pond needs almost none:
 * water and grid are far below what light text needs. It comes up to full while the creature (a bright thing) is
 * within `margin` pixels of the text, where scenery is on screen (`props`, 0 to 1), and by day (`day`, 0 to 1) when
 * the whole pond is bright. The largest of those wins. Large text needs a little less by day (`LARGE_DAY_SHARE`).
 */
/** By day large text keeps this share of the full veil: it tolerates less contrast, but a muted large title still needs a calm backdrop. */
export const LARGE_DAY_SHARE = 0.8;

export function veilOpacity(
  rect: Rect,
  creature: Rect | null,
  { day, props, floor, margin }: { day: number; props: number; floor: number; margin: number },
): number {
  const dayShare = Math.min(1, Math.max(0, day));
  const large = rect.large === true;
  const near = creature && rectsNear(rect, creature, margin) ? 1 : 0;
  const need = Math.max(near, Math.min(1, Math.max(0, props)), dayShare * (large ? LARGE_DAY_SHARE : 1));
  return floor + (1 - floor) * need;
}

const SPOT_COLS = 16;
const SPOT_ROWS = 9;
const SPOT_MARGIN_X = 0.07;
const SPOT_MARGIN_Y = 0.12;
/** Feather (px) over which a block of text counts as near a candidate spot. */
const SPOT_FEATHER = 60;
/** A previous spot is kept while it costs no more than this much above the best one. */
const SPOT_KEEP = 0.12;

/** Per-cell text coverage and crowding, reused by every call (one pass over the rectangles, then only arithmetic). */
const spotCover = new Float32Array(SPOT_COLS * SPOT_ROWS);
const spotCost = new Float32Array(SPOT_COLS * SPOT_ROWS);

/**
 * The emptiest place on the screen (viewport pixels): where no text is, with room around it, so the creature's big
 * moment (the koi turning into the dragon) is staged on open water instead of behind a card. A coarse grid, scored by
 * how much text is near each spot (each rectangle is tested once per cell, the neighbourhood average is then taken from
 * the grid), with a mild pull towards the lower middle. Pass the spot found last time as `prev` and it is returned again
 * (the same object) unless something clearly better has opened up. Writes into `out` when given.
 */
export function findOpenSpot(
  rects: readonly Rect[],
  width: number,
  height: number,
  prev: { x: number; y: number } | null = null,
  out: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  const x0 = width * SPOT_MARGIN_X;
  const y0 = height * SPOT_MARGIN_Y;
  const dx = (width * (1 - 2 * SPOT_MARGIN_X)) / (SPOT_COLS - 1);
  const dy = (height * (1 - 2 * SPOT_MARGIN_Y)) / (SPOT_ROWS - 1);
  for (let j = 0; j < SPOT_ROWS; j++) {
    for (let i = 0; i < SPOT_COLS; i++) spotCover[j * SPOT_COLS + i] = rectCoverage(rects, x0 + i * dx, y0 + j * dy, SPOT_FEATHER);
  }
  let best = Infinity;
  let bi = 0;
  let bj = 0;
  for (let j = 0; j < SPOT_ROWS; j++) {
    for (let i = 0; i < SPOT_COLS; i++) {
      let sum = 0;
      let n = 0;
      for (let b = Math.max(0, j - 1); b <= Math.min(SPOT_ROWS - 1, j + 1); b++) {
        for (let a = Math.max(0, i - 1); a <= Math.min(SPOT_COLS - 1, i + 1); a++) {
          sum += spotCover[b * SPOT_COLS + a];
          n++;
        }
      }
      const c = sum / n + 0.06 * Math.hypot((x0 + i * dx) / width - 0.45, (y0 + j * dy) / height - 0.6);
      spotCost[j * SPOT_COLS + i] = c;
      if (c < best) {
        best = c;
        bi = i;
        bj = j;
      }
    }
  }
  if (prev) {
    const pi = Math.min(SPOT_COLS - 1, Math.max(0, Math.round((prev.x - x0) / dx)));
    const pj = Math.min(SPOT_ROWS - 1, Math.max(0, Math.round((prev.y - y0) / dy)));
    if (spotCost[pj * SPOT_COLS + pi] <= best + SPOT_KEEP) return prev;
  }
  out.x = x0 + bi * dx;
  out.y = y0 + bj * dy;
  return out;
}
