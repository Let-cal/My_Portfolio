export type Box = { left: number; top: number; right: number; bottom: number };

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * SVG path (cubic bezier, S-shaped) from a skill chip to an evidence card, in coordinates relative to `origin`
 * (the top-left of the element the SVG overlays). A card that sits clearly to the right gets a sideways beam from the
 * chip's right edge; otherwise the beam leaves the chip's bottom (or top) edge and enters the card's left edge.
 */
export function beamPath(
  from: Box,
  to: Box,
  origin: { left: number; top: number },
): string {
  const ox = origin.left;
  const oy = origin.top;
  const cx = (b: Box) => (b.left + b.right) / 2 - ox;
  const cy = (b: Box) => (b.top + b.bottom) / 2 - oy;

  if (to.left > from.right + 24) {
    const x1 = from.right - ox;
    const y1 = cy(from);
    const x2 = to.left - ox;
    const y2 = cy(to);
    const mx = (x1 + x2) / 2;
    return `M${round(x1)} ${round(y1)} C${round(mx)} ${round(y1)}, ${round(mx)} ${round(y2)}, ${round(x2)} ${round(y2)}`;
  }

  // Stacked layout: leave the chip's bottom (or top) edge and run down the left side of the cards, entering each
  // from the left, so beams to a column of cards do not cut through the cards above them.
  const down = cy(to) >= cy(from);
  const x1 = cx(from);
  const y1 = (down ? from.bottom : from.top) - oy;
  const x2 = to.left - ox;
  const y2 = cy(to);
  const reach = Math.min(40, Math.max(12, x2 / 2));
  const my = y1 + (y2 - y1) * 0.55;
  return `M${round(x1)} ${round(y1)} C${round(x1)} ${round(my)}, ${round(x2 - reach)} ${round(y2)}, ${round(x2)} ${round(y2)}`;
}
