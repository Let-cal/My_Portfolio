/** A screen-space rectangle in CSS pixels, y down, relative to the viewport. */
export type Rect = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Large text (24px, or 19px bold, and up): readable at a lower contrast, so by day it needs no veil of its own. */
  large?: boolean;
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
 * Joins rectangles that touch or are closer than `gap` pixels into their bounding box, repeatedly, so a row of chips or
 * the lines of a list become one block instead of dozens of rectangles. A new array: the input is left alone.
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
        if (b.x0 - a.x1 <= gap && a.x0 - b.x1 <= gap && b.y0 - a.y1 <= gap && a.y0 - b.y1 <= gap) {
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
    if (x1 - x0 > 0 && y1 - y0 > 0) kept.push({ x0, y0, x1, y1, large: r.large });
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
 * the whole pond is bright. The largest of those wins. Large text needs less: by day its dark letters stand out of the
 * pale pond (and of a koi) on their own, so only scenery can call for a veil there.
 */
export function veilOpacity(
  rect: Rect,
  creature: Rect | null,
  { day, props, floor, margin }: { day: number; props: number; floor: number; margin: number },
): number {
  const dayShare = Math.min(1, Math.max(0, day));
  const large = rect.large === true;
  const near = creature && rectsNear(rect, creature, margin) ? (large ? 1 - dayShare : 1) : 0;
  const need = Math.max(near, Math.min(1, Math.max(0, props)), large ? 0 : dayShare);
  return floor + (1 - floor) * need;
}
