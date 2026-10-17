import { BufferAttribute, BufferGeometry } from "three";

/*
 * Fins are fans in the creature's local frame (x = forward along T, y = up along U, z = right along S). Spoke s
 * points at angle theta(s) in the x/z plane; ring r goes from the base (0) to the outline (1). uv.x is the ring
 * fraction (base to edge) and uv.y the spoke fraction, matching makeFinTexture. The rest positions are kept so
 * the fin can be bent every frame without accumulating error.
 */

export type FanGeometry = BufferGeometry & { userData: { rest: Float32Array; radial: Float32Array } };

export function fanGeometry(
  spokes: number,
  rings: number,
  theta0: number,
  theta1: number,
  outline: (s: number) => number,
  side: 1 | -1 = 1,
): FanGeometry {
  const cols = spokes + 1;
  const count = (rings + 1) * cols;
  const pos = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const radial = new Float32Array(count);
  for (let r = 0; r <= rings; r++) {
    const f = r / rings;
    for (let s = 0; s < cols; s++) {
      const q = s / spokes;
      const th = theta0 + (theta1 - theta0) * q;
      const len = outline(q) * f;
      const k = r * cols + s;
      pos[k * 3] = Math.cos(th) * len;
      pos[k * 3 + 1] = 0;
      pos[k * 3 + 2] = Math.sin(th) * len * side;
      uv[k * 2] = f;
      uv[k * 2 + 1] = q;
      radial[k] = f;
    }
  }
  const index: number[] = [];
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < spokes; s++) {
      const a = r * cols + s;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const g = new BufferGeometry() as FanGeometry;
  g.setIndex(index);
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(count * 3), 3));
  g.userData = { rest: pos.slice(), radial };
  g.computeVertexNormals();
  return g;
}

/**
 * Bends a fan in place: each vertex swings around the fin base by `swing * f * sin(phase - wave * f)` (a wave
 * running out to the edge), lifts by `lift * f^2`, and ripples up and down by `ripple`. f = distance from the base, 0..1.
 */
export function flexFan(g: FanGeometry, swing: number, phase: number, wave: number, lift: number, ripple: number) {
  const { rest, radial } = g.userData;
  const attr = g.getAttribute("position") as BufferAttribute;
  const pos = attr.array as Float32Array;
  for (let k = 0; k < radial.length; k++) {
    const f = radial[k];
    const x = rest[k * 3];
    const z = rest[k * 3 + 2];
    const w = Math.sin(phase - wave * f);
    const a = swing * f * w;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pos[k * 3] = x * c - z * s;
    pos[k * 3 + 1] = lift * f * f + ripple * f * w;
    pos[k * 3 + 2] = x * s + z * c;
  }
  // Normals stay the rest normals (straight up): the bend is gentle, and recomputing them would allocate every frame.
  attr.needsUpdate = true;
}

/** Koi pectoral fin: a broad rounded paddle sweeping back from the side. */
export const pectoralOutline = (s: number) => 0.36 * (0.55 + 0.45 * Math.pow(Math.sin(Math.PI * s), 0.6)) * (1 - 0.25 * s);

/** Koi tail: two long rounded lobes with a shallow fork between them. */
export const tailOutline = (s: number) => {
  const edge = Math.abs(2 * s - 1);
  const lobe = 0.5 + 0.5 * Math.pow(edge, 1.2);
  const round = 0.55 + 0.45 * Math.pow(Math.sin(Math.PI * s), 0.3);
  return 0.52 * lobe * round;
};

/**
 * A dorsal-fin ribbon along the back: `cols` columns x 3 rows (base, middle, edge). Positions are written each
 * frame by the rig; uv.x = base (0) to edge (1), uv.y = front (0) to back (1).
 */
export function ribbonGeometry(cols: number): BufferGeometry {
  const rows = 3;
  const count = cols * rows;
  const uv = new Float32Array(count * 2);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const k = c * rows + r;
      uv[k * 2] = r / (rows - 1);
      uv[k * 2 + 1] = c / (cols - 1);
    }
  }
  const index: number[] = [];
  for (let c = 0; c < cols - 1; c++) {
    for (let r = 0; r < rows - 1; r++) {
      const a = c * rows + r;
      const b = a + 1;
      const d = a + rows;
      const e = d + 1;
      index.push(a, d, b, b, d, e);
    }
  }
  const g = new BufferGeometry();
  g.setIndex(index);
  g.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  return g;
}

type Curve = (s: number) => [number, number, number];

/** Appends a tapered tube along `at(s)`, s 0..1, to `positions` / `index` (8 sides). */
function tube(positions: number[], index: number[], steps: number, at: Curve, radius: (s: number) => number) {
  const radial = 8;
  const start = positions.length / 3;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const [px, py, pz] = at(s);
    const [qx, qy, qz] = at(Math.min(1, s + 1e-3));
    const [ox, oy, oz] = at(Math.max(0, s - 1e-3));
    let tx = qx - ox;
    let ty = qy - oy;
    let tz = qz - oz;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    // Ring basis: n = z x t (falls back to x when t is along z), b = t x n.
    let nx = -ty;
    let ny = tx;
    let nz = 0;
    let nl = Math.hypot(nx, ny);
    if (nl < 1e-6) {
      nx = 1;
      ny = 0;
      nz = 0;
      nl = 1;
    }
    nx /= nl;
    ny /= nl;
    const bx = ty * nz - tz * ny;
    const by = tz * nx - tx * nz;
    const bz = tx * ny - ty * nx;
    const r = radius(s);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a) * r;
      const d = Math.sin(a) * r;
      positions.push(px + nx * c + bx * d, py + ny * c + by * d, pz + nz * c + bz * d);
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < radial; j++) {
      const a = start + i * radial + j;
      const b = start + i * radial + ((j + 1) % radial);
      const c = a + radial;
      const d = b + radial;
      index.push(a, c, b, b, c, d);
    }
  }
}

function tubesGeometry(build: (add: (steps: number, at: Curve, radius: (s: number) => number) => void) => void) {
  const positions: number[] = [];
  const index: number[] = [];
  build((steps, at, radius) => tube(positions, index, steps, at, radius));
  const g = new BufferGeometry();
  g.setIndex(index);
  g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  g.computeVertexNormals();
  return g;
}

/** A curved, tapering horn with one tine, along +y, bending towards +x. Base at the origin. */
export function hornGeometry(): BufferGeometry {
  return tubesGeometry((add) => {
    const L = 0.26;
    const main: Curve = (s) => [0.09 * s * s, L * s, 0];
    add(10, main, (s) => 0.032 * Math.pow(1 - s, 0.85) + 0.002);
    const [bx, by] = main(0.45);
    add(6, (s) => [bx - 0.05 * s, by + 0.075 * s - 0.01 * s * s, 0], (s) => 0.016 * Math.pow(1 - s, 0.9) + 0.0015);
  });
}

/** A dragon leg along +y (hip at the origin), bent at the knee towards +x, ending in three curled claws. */
export function legGeometry(): BufferGeometry {
  return tubesGeometry((add) => {
    const leg: Curve = (s) => [-0.07 * s + 0.12 * s * s, 0.24 * s, 0];
    add(10, leg, (s) => 0.04 * (1 - 0.5 * s) + 0.004 * Math.sin(Math.PI * s));
    const [ex, ey] = leg(1);
    for (const c of [-1, 0, 1]) {
      add(
        5,
        (s) => [ex + 0.055 * s - 0.03 * s * s, ey + 0.035 * s + 0.02 * s * s, c * 0.032 * s],
        (s) => 0.012 * (1 - s) + 0.0015,
      );
    }
  });
}
