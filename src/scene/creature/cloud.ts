import { CAP_RINGS } from "./geometry";

/**
 * Which vertices of the body mesh (layout in geometry.ts) become points of the cloud. The seam column repeats
 * column 0 and the first and last rings are zero-radius tips whose vertices all sit on one spot, so: no seam, and
 * one point at each tip. `stride` thins the rest evenly (a checkerboard over rings and columns, so no stripe of
 * the body is left bare); 1 keeps every vertex.
 */
export function cloudIndices(
  rings: number,
  sides: number,
  stride = 1,
): Uint32Array {
  const total = rings + 2 * CAP_RINGS;
  const cols = sides + 1;
  const step = Math.max(1, Math.floor(stride) || 1);
  const out: number[] = [0];
  for (let r = 1; r < total - 1; r++) {
    for (let j = 0; j < sides; j++) {
      if ((j + r) % step === 0) out.push(r * cols + j);
    }
  }
  out.push((total - 1) * cols);
  return Uint32Array.from(out);
}
