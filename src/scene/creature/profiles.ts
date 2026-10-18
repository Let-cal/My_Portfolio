/** Body shape of the creature as a function of `u` (0 = snout, 1 = tail tip) and `morph` (0 = koi, 1 = dragon). */

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Koi half-width: a rounded head that swells to the shoulder (u = 0.3), then tapers to the tail. Prototype x1.25. */
export function koiRadius(u: number): number {
  const f = u < 0.3 ? 0.55 + 0.45 * Math.sin(((u / 0.3) * Math.PI) / 2) : Math.cos((((u - 0.3) / 0.7) * Math.PI) / 2);
  return 1.25 * (0.025 + 0.2 * f) * Math.sqrt(Math.min(1, u / 0.05 + 0.2));
}

/** Dragon half-width: a bulging head (u < 0.08), then a long serpentine taper. */
export function dragonRadius(u: number): number {
  const r = u < 0.08 ? 0.13 + 0.04 * Math.sin((u / 0.08) * Math.PI) : 0.022 + 0.11 * Math.pow(1 - (u - 0.08) / 0.92, 0.6);
  return r * Math.sqrt(Math.min(1, u / 0.03 + 0.3));
}

export const KOI_LENGTH = 1.7;
export const DRAGON_LENGTH = 6.2;

export function bodyLength(morph: number): number {
  return lerp(KOI_LENGTH, DRAGON_LENGTH, morph);
}

/** Cross-section half-axes: `rx` across the body (sideways), `ry` up. The koi is a flattened oval, the dragon nearly round. */
export function ringRadii(u: number, morph: number, out: { rx: number; ry: number }): { rx: number; ry: number } {
  const rx = lerp(koiRadius(u), dragonRadius(u), morph);
  out.rx = rx;
  out.ry = rx * lerp(0.72, 0.95, morph);
  return out;
}

/**
 * Swimming motion at `u`: `lat` is the sideways body wave (a koi beats its tail, the dragon undulates along its
 * whole length) and `lift` how high the body rises out of the water (the dragon flies).
 */
export function swimOffset(u: number, t: number, morph: number, out: { lat: number; lift: number }) {
  out.lat = Math.sin(t * 7 - u * 7) * 0.06 * u * u * (1 - morph) + Math.sin(t * 2.4 - u * 9) * 0.06 * morph * u;
  out.lift = morph * (0.75 + Math.sin(t * 1.8 - u * 8) * 0.32 * Math.min(1, u * 5));
  return out;
}
