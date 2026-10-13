import { BufferAttribute, BufferGeometry } from "three";
import { mulberry32 } from "./random";
import type { Frame, Vec3 } from "./spine";

/**
 * Body mesh layout (shared with the point-cloud dissolve, Task 17):
 *
 * - `CAP_RINGS` nose-cap rings, then `rings` body rings (head to tail), then `CAP_RINGS` tail-cap rings. The first
 *   and the last ring have zero radius, so the tube is closed at both ends.
 * - Each ring has `sides + 1` vertices: column `sides` repeats column 0 so the texture wraps without a seam.
 *   Column j sits at angle `2*pi*j/sides`, measured from the right side (S) towards the back (U).
 * - Attributes: `position`, `normal` (rewritten every frame by `writeBody`), `uv` (x: 0 snout to 1 tail tip along
 *   the body, y: around the ring, 0.25 = middle of the back, 0.75 = belly) and `aRand` (3 seeded values in -1..1
 *   per vertex, for scattering the points).
 */
export const CAP_RINGS = 4;

export function bodyVertexCount(rings: number, sides: number): number {
  return (rings + 2 * CAP_RINGS) * (sides + 1);
}

type RingTables = { cos: Float32Array; sin: Float32Array; rings: number; sides: number };

export function createBodyGeometry(rings: number, sides: number): BufferGeometry {
  const total = rings + 2 * CAP_RINGS;
  const cols = sides + 1;
  const count = total * cols;
  const g = new BufferGeometry();
  const uv = new Float32Array(count * 2);
  const rnd = new Float32Array(count * 3);
  const random = mulberry32(42);
  for (let r = 0; r < total; r++) {
    const i = r - CAP_RINGS;
    const u = i <= 0 ? 0 : i >= rings - 1 ? 1 : i / (rings - 1);
    for (let j = 0; j < cols; j++) {
      const k = r * cols + j;
      uv[k * 2] = u;
      uv[k * 2 + 1] = j / sides;
    }
  }
  for (let k = 0; k < count * 3; k++) rnd[k] = random() * 2 - 1;
  const index: number[] = [];
  for (let r = 0; r < total - 1; r++) {
    for (let j = 0; j < sides; j++) {
      const a = r * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      // Counter-clockwise seen from outside: front faces point away from the spine.
      index.push(a, b, c, b, d, c);
    }
  }
  g.setIndex(index);
  g.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  g.setAttribute("aRand", new BufferAttribute(rnd, 3));
  const cos = new Float32Array(cols);
  const sin = new Float32Array(cols);
  for (let j = 0; j < cols; j++) {
    const a = (j / sides) * Math.PI * 2;
    cos[j] = Math.cos(a);
    sin[j] = Math.sin(a);
  }
  // Exact closure: column `sides` must land on column 0.
  cos[sides] = cos[0];
  sin[sides] = sin[0];
  g.userData.ring = { cos, sin, rings, sides } satisfies RingTables;
  return g;
}

/**
 * Writes the tube around the spine: ring i is an ellipse with half-axes `rx[i]` (along S) and `ry[i]` (along U)
 * centred on `points[i]`. The caps are quarter-ellipsoids; `noseLength` stretches the nose cap (1 = round koi
 * snout, larger = dragon muzzle). Normals are analytic (smooth across the seam), so no computeVertexNormals.
 */
export function writeBody(
  g: BufferGeometry,
  points: Vec3[],
  frames: Frame[],
  rx: ArrayLike<number>,
  ry: ArrayLike<number>,
  noseLength = 1,
): void {
  const { cos, sin, rings, sides } = g.userData.ring as RingTables;
  const cols = sides + 1;
  const posAttr = g.getAttribute("position") as BufferAttribute;
  const norAttr = g.getAttribute("normal") as BufferAttribute;
  const pos = posAttr.array as Float32Array;
  const nor = norAttr.array as Float32Array;
  const total = rings + 2 * CAP_RINGS;

  for (let r = 0; r < total; r++) {
    let i: number;
    // Cap rings: phi = 0 at the body end ring, pi/2 at the tip.
    let phi = 0;
    let dir = 0;
    if (r < CAP_RINGS) {
      i = 0;
      phi = ((CAP_RINGS - r) / CAP_RINGS) * (Math.PI / 2);
      dir = 1;
    } else if (r >= CAP_RINGS + rings) {
      i = rings - 1;
      phi = ((r - CAP_RINGS - rings + 1) / CAP_RINGS) * (Math.PI / 2);
      dir = -1;
    } else {
      i = r - CAP_RINGS;
    }
    const P = points[i];
    const { T, S, U } = frames[i];
    const capCos = Math.cos(phi);
    const capSin = Math.sin(phi);
    const capLen = dir > 0 ? rx[i] * noseLength : rx[i];
    const cx = P.x + T.x * capSin * capLen * dir;
    const cy = P.y + T.y * capSin * capLen * dir;
    const cz = P.z + T.z * capSin * capLen * dir;
    const ex = rx[i] * capCos;
    const ey = ry[i] * capCos;

    // Taper along the body tilts the normal back (wider towards the head) or forward.
    let slope = 0;
    if (dir === 0) {
      const a = Math.max(0, i - 1);
      const b = Math.min(rings - 1, i + 1);
      const pa = points[a];
      const pb = points[b];
      const ds = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
      if (ds > 1e-9) slope = (rx[a] - rx[b]) / ds;
    }

    for (let j = 0; j < cols; j++) {
      const k = (r * cols + j) * 3;
      const c = cos[j];
      const s = sin[j];
      pos[k] = cx + S.x * c * ex + U.x * s * ey;
      pos[k + 1] = cy + S.y * c * ex + U.y * s * ey;
      pos[k + 2] = cz + S.z * c * ex + U.z * s * ey;

      // Ellipse normal in the ring plane: (cos/rx, sin/ry), scaled by rx*ry to avoid dividing by zero.
      let nx = S.x * c * ry[i] + U.x * s * rx[i];
      let ny = S.y * c * ry[i] + U.y * s * rx[i];
      let nz = S.z * c * ry[i] + U.z * s * rx[i];
      let nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      if (dir === 0) {
        nx -= T.x * slope;
        ny -= T.y * slope;
        nz -= T.z * slope;
      } else {
        nx = nx * capCos + T.x * capSin * dir;
        ny = ny * capCos + T.y * capSin * dir;
        nz = nz * capCos + T.z * capSin * dir;
      }
      nl = Math.hypot(nx, ny, nz) || 1;
      nor[k] = nx / nl;
      nor[k + 1] = ny / nl;
      nor[k + 2] = nz / nl;
    }
  }
  posAttr.needsUpdate = true;
  norAttr.needsUpdate = true;
}
