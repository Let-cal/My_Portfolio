import { rectCoverage, type Rect } from "../environment/legibility";

/** Screen-space helpers for the guardian dragon's ring (viewport pixels). */

type Pt = { x: number; y: number };

/**
 * Moves the centre of a ring with half-axes `rx` and `ry` (px) the least it takes for the whole ring to lie on screen with
 * `margin` px to spare on every side. A ring wider than the screen is centred. Writes into `out`.
 */
export function fitRing(cx: number, cy: number, rx: number, ry: number, width: number, height: number, margin: number, out: Pt): Pt {
  const minX = rx + margin;
  const maxX = width - rx - margin;
  const minY = ry + margin;
  const maxY = height - ry - margin;
  out.x = minX <= maxX ? Math.min(maxX, Math.max(minX, cx)) : width / 2;
  out.y = minY <= maxY ? Math.min(maxY, Math.max(minY, cy)) : height / 2;
  return out;
}

/** Points sampled round the ring when scoring a candidate centre. */
const RING_SAMPLES = 16;
/** The button stays inside this share of the ring's half-axes, so the dragon still circles it. */
const KEEP_INSIDE = 0.8;
const OFFSET_STEPS_X = 4;
const OFFSET_STEPS_Y = 2;
const RING_FEATHER = 36;
/** How strongly a centre far from the button is penalised (per ring half-axis of offset). */
const OFFSET_COST = 0.12;

const scratch: Pt = { x: 0, y: 0 };

/** How crowded the ring is: the text coverage averaged over points round it. */
function ringCrowd(rects: readonly Rect[], cx: number, cy: number, rx: number, ry: number): number {
  let sum = 0;
  for (let k = 0; k < RING_SAMPLES; k++) {
    const a = (k / RING_SAMPLES) * Math.PI * 2;
    sum += rectCoverage(rects, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, RING_FEATHER);
  }
  return sum / RING_SAMPLES;
}

/**
 * Where on the screen the guardian's ring is centred: round the button, but on whichever side leaves most of the lap on
 * open water (away from big headlines and blocks of text), and always entirely on screen (see `fitRing`). Candidates
 * are centres within reach of the button (it must stay inside the ring), each moved on screen, scored by how much text
 * the ring crosses; a centre far from the button costs a little. Writes into `out`.
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
  for (let j = -OFFSET_STEPS_Y; j <= OFFSET_STEPS_Y; j++) {
    for (let i = -OFFSET_STEPS_X; i <= OFFSET_STEPS_X; i++) {
      fitRing(cta.x + (i / OFFSET_STEPS_X) * KEEP_INSIDE * rx, cta.y + (j / OFFSET_STEPS_Y) * KEEP_INSIDE * ry, rx, ry, width, height, margin, scratch);
      // Still round the button after the move? (The unmoved centre is always a candidate.)
      const dx = (cta.x - scratch.x) / (KEEP_INSIDE * rx);
      const dy = (cta.y - scratch.y) / (KEEP_INSIDE * ry);
      if (dx * dx + dy * dy > 1 && !(i === 0 && j === 0)) continue;
      const cost = ringCrowd(rects, scratch.x, scratch.y, rx, ry) + OFFSET_COST * (Math.abs(scratch.x - cta.x) / rx + Math.abs(scratch.y - cta.y) / ry);
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
