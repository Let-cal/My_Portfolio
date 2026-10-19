/** Moves `current` towards `target` and stops on it. A full 0 to 1 swing takes `duration` seconds (default 0.6). */
export function stepDay(
  current: number,
  target: number,
  dt: number,
  duration = 0.6,
): number {
  const step = dt / duration;
  if (current < target) return Math.min(target, current + step);
  return Math.max(target, current - step);
}

/** Exponential smoothing that does not depend on the frame rate: `rate` per second. */
export function dampValue(
  current: number,
  target: number,
  rate: number,
  dt: number,
): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * How present a prop that belongs to chapter `k` is when the story is at `pos`: 1 on its chapter, fading to 0 over
 * the next chapter either side (so it is gone by the time the camera reaches a neighbouring chapter's pose).
 */
export function propWeight(
  pos: number,
  k: number,
  inner = 0.25,
  outer = 1.0,
): number {
  return 1 - smoothstep(inner, outer, Math.abs(pos - k));
}
