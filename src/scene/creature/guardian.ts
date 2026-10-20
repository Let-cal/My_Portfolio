import { rectCoverage, type Rect } from "../environment/legibility";

/** Screen-space helpers for the guardian dragon's ring (viewport pixels). */

type Pt = { x: number; y: number };

/**
 * Moves the centre of a ring with half-axes `rx` and `ry` (px) the least it takes for the whole ring to lie on screen with
 * `margin` px to spare on every side. A ring wider than the screen is centred. Writes into `out`.
 */
export function fitRing(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  width: number,
  height: number,
  margin: number,
  out: Pt,
): Pt {
  const minX = rx + margin;
  const maxX = width - rx - margin;
  const minY = ry + margin;
  const maxY = height - ry - margin;
  out.x = minX <= maxX ? Math.min(maxX, Math.max(minX, cx)) : width / 2;
  out.y = minY <= maxY ? Math.min(maxY, Math.max(minY, cy)) : height / 2;
  return out;
}

/** Points sampled along the ring's path when scoring a candidate centre. */
const RING_SAMPLES = 24;
/**
 * The button must lie inside the ring or within this share of the ring's half-axes of its path (so the dragon still
 * guards it): in units of the half-axes, a candidate centre is allowed while the button is at most `1 + NEAR_PATH` of them away.
 */
export const NEAR_PATH = 0.25;
const OFFSET_STEPS_X = 6;
const OFFSET_STEPS_Y = 3;
/** Feather (px) over which text counts as under a point of the path: the veil's solid pad is 24 px. */
const RING_FEATHER = 28;
/** A small pull towards the button, so with equally open choices the ring stays round it. */
const OFFSET_COST = 0.04;

const scratch: Pt = { x: 0, y: 0 };

/** How much of the ring's path lies on text: the coverage (0 clear, 1 under a block) averaged over points along it. */
export function ringCrowd(
  rects: readonly Rect[],
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): number {
  let sum = 0;
  for (let k = 0; k < RING_SAMPLES; k++) {
    const a = (k / RING_SAMPLES) * Math.PI * 2;
    sum += rectCoverage(
      rects,
      cx + Math.cos(a) * rx,
      cy + Math.sin(a) * ry,
      RING_FEATHER,
    );
  }
  return sum / RING_SAMPLES;
}

/**
 * Where on the screen the guardian's ring is centred. The rule: the button lies inside the ring or within a quarter of its
 * half-axes of the path (`NEAR_PATH`); within that, the centre (a grid around the button reaching out to 1.25 half-axes
 * each way, each moved on screen by `fitRing`) is the one whose path crosses the least text, so most of every lap, head
 * and body, is on open water. A centre far from the button costs a little. Writes into `out`.
 */
export function ringCentre(
  cta: { x: number; y: number; r: number },
  rx: number,
  ry: number,
  rects: readonly Rect[],
  width: number,
  height: number,
  margin: number,
  out: Pt,
): Pt {
  let best = Infinity;
  let bx = cta.x;
  let by = cta.y;
  const reach = 1 + NEAR_PATH;
  for (let j = -OFFSET_STEPS_Y; j <= OFFSET_STEPS_Y; j++) {
    for (let i = -OFFSET_STEPS_X; i <= OFFSET_STEPS_X; i++) {
      fitRing(
        cta.x + (i / OFFSET_STEPS_X) * reach * rx,
        cta.y + (j / OFFSET_STEPS_Y) * reach * ry,
        rx,
        ry,
        width,
        height,
        margin,
        scratch,
      );
      // Is the button still inside the ring or just by its path after the move? (The unmoved centre is always a candidate.)
      const dx = (cta.x - scratch.x) / rx;
      const dy = (cta.y - scratch.y) / ry;
      const away = Math.hypot(dx, dy);
      if (away > reach && !(i === 0 && j === 0)) continue;
      const cost =
        ringCrowd(rects, scratch.x, scratch.y, rx, ry) + OFFSET_COST * away;
      if (cost < best) {
        best = cost;
        bx = scratch.x;
        by = scratch.y;
      }
    }
  }
  out.x = bx;
  out.y = by;
  return out;
}
