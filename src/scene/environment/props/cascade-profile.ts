import { smoothstep } from "../math";

/** Shared physical terrace profile, in units towards the viewer from FALL_Z. */
export function cascadeDepth(height: number): number {
  return 0.6 + 0.75 * (1 - smoothstep(0.6, 0.7, height)) + (1 - smoothstep(0.25, 0.35, height));
}
