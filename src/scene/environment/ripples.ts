/** Ripples the water can show at once (a fixed-size uniform array in its shader). */
export const MAX_RIPPLES = 12;
/** `t0` of a slot that has never been used: far enough in the past to be invisible. */
export const RIPPLE_IDLE = -1000;

/** `data` is `MAX_RIPPLES` triples `{x, z, t0}`, laid out as the water shader's `vec3 uRipples[12]`. */
export type RippleBuffer = { data: Float32Array; next: number };

export function createRipples(): RippleBuffer {
  const data = new Float32Array(MAX_RIPPLES * 3);
  for (let i = 0; i < MAX_RIPPLES; i++) data[i * 3 + 2] = RIPPLE_IDLE;
  return { data, next: 0 };
}

/** Starts a ripple at (x, z) at time `t0`, in the oldest slot. No allocation. */
export function addRipple(buffer: RippleBuffer, x: number, z: number, t0: number): void {
  const i = buffer.next * 3;
  buffer.data[i] = x;
  buffer.data[i + 1] = z;
  buffer.data[i + 2] = t0;
  buffer.next = (buffer.next + 1) % MAX_RIPPLES;
}

export function resetRipples(buffer: RippleBuffer): void {
  for (let i = 0; i < MAX_RIPPLES; i++) {
    buffer.data[i * 3] = 0;
    buffer.data[i * 3 + 1] = 0;
    buffer.data[i * 3 + 2] = RIPPLE_IDLE;
  }
  buffer.next = 0;
}
