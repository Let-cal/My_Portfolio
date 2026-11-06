/**
 * Zoom and pan math of the full-screen figure viewer (spec 6.3). Pure: no DOM.
 *
 * The figure (`content`, its natural size) is drawn in the canvas (`box`) with `translate(x, y) scale(scale)`
 * from the canvas top-left, so its top-left corner sits at (x, y) and it covers content * scale. The scale stays
 * between the fit (the whole figure visible) and 400% (or the fit, for a figure so small that it fits above 400%).
 * Along an axis where the scaled figure is smaller than the canvas it is centred; along a larger one it always
 * covers the canvas, so the figure never leaves the box.
 */

export type Size = { w: number; h: number };
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type View = { scale: number; x: number; y: number };

export const MAX_SCALE = 4;

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

/** The largest scale that shows the whole figure; 1 while either size is still unknown (zero). */
export function fitScale(content: Size, box: Size): number {
  if (content.w <= 0 || content.h <= 0 || box.w <= 0 || box.h <= 0) return 1;
  return Math.min(box.w / content.w, box.h / content.h);
}

/** The figure at fit, centred. */
export function fitView(content: Size, box: Size): View {
  const fit = fitScale(content, box);
  return clampView({ scale: fit, x: 0, y: 0 }, content, box, fit);
}

/** Beyond this the view counts as zoomed (pan buttons, minimap, arrows pan). */
export function isZoomed(v: View, fit: number): boolean {
  return v.scale > fit * 1.001;
}

function axis(pos: number, size: number, boxSize: number) {
  return size <= boxSize ? (boxSize - size) / 2 : clamp(pos, boxSize - size, 0);
}

/** Scale in [fit, max(fit, 400%)]; each axis centred or covering the box. */
export function clampView(
  v: View,
  content: Size,
  box: Size,
  fit: number,
): View {
  const scale = clamp(v.scale, fit, Math.max(fit, MAX_SCALE));
  return {
    scale,
    x: axis(v.x, content.w * scale, box.w),
    y: axis(v.y, content.h * scale, box.h),
  };
}

/** Sets the scale to `scale`, keeping the figure point under `point` (canvas coordinates) where it is. */
export function zoomTo(
  v: View,
  scale: number,
  point: Point,
  content: Size,
  box: Size,
  fit: number,
): View {
  const next = clamp(scale, fit, Math.max(fit, MAX_SCALE));
  const fx = (point.x - v.x) / v.scale;
  const fy = (point.y - v.y) / v.scale;
  return clampView(
    { scale: next, x: point.x - fx * next, y: point.y - fy * next },
    content,
    box,
    fit,
  );
}

/** Multiplies the scale by `factor` around `point` (the wheel, pinch and the zoom buttons). */
export function zoomAt(
  v: View,
  factor: number,
  point: Point,
  content: Size,
  box: Size,
  fit: number,
): View {
  return zoomTo(v, v.scale * factor, point, content, box, fit);
}

/** Moves the figure by (dx, dy) canvas pixels, stopping at the edges. */
export function panBy(
  v: View,
  dx: number,
  dy: number,
  content: Size,
  box: Size,
  fit: number,
): View {
  return clampView({ ...v, x: v.x + dx, y: v.y + dy }, content, box, fit);
}

/** Puts the figure point at fractions (fx, fy) of its size in the middle of the canvas (a minimap click). */
export function centerOn(
  v: View,
  fx: number,
  fy: number,
  content: Size,
  box: Size,
  fit: number,
): View {
  return clampView(
    {
      ...v,
      x: box.w / 2 - fx * content.w * v.scale,
      y: box.h / 2 - fy * content.h * v.scale,
    },
    content,
    box,
    fit,
  );
}

/** The visible part of the figure, as fractions (0..1) of its size, for the minimap frame. */
export function minimapRect(v: View, content: Size, box: Size): Rect {
  const w = content.w * v.scale;
  const h = content.h * v.scale;
  if (w <= 0 || h <= 0) return { x: 0, y: 0, w: 1, h: 1 };
  const left = clamp(-v.x / w, 0, 1);
  const top = clamp(-v.y / h, 0, 1);
  const right = clamp((box.w - v.x) / w, 0, 1);
  const bottom = clamp((box.h - v.y) / h, 0, 1);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Where a figure shown with `object-fit: contain` inside `rect` is drawn. */
export function containRect(content: Size, rect: Rect): Rect {
  const s = fitScale(content, rect);
  const w = content.w * s;
  const h = content.h * s;
  return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h };
}

/**
 * The transform (translate x, y then scale s, around `origin`) that draws `from` where `to` is: the FLIP step of
 * the viewer's open and close motion. Uniform scale, from the widths (the two rects share the figure's ratio).
 */
export function flipTransform(
  from: Rect,
  to: Rect,
  origin: Point,
): { x: number; y: number; s: number } {
  const s = from.w > 0 ? to.w / from.w : 1;
  return {
    s,
    x: to.x - origin.x - s * (from.x - origin.x),
    y: to.y - origin.y - s * (from.y - origin.y),
  };
}
