import { clamp, lerp } from "./profiles";

/** A point or direction. Structurally compatible with `THREE.Vector3`, so the scene can pass its own vectors. */
export type Vec3 = { x: number; y: number; z: number };

/** Moving frame along the spine: `T` points towards the head, `S` to the creature's right side, `U` up. */
export type Frame = { T: Vec3; S: Vec3; U: Vec3 };

export type SteerState = { head: Vec3; heading: number };

/** Largest turn per 60 Hz frame (radians). */
export const MAX_TURN = 0.06;
/** Tightest circle the head may swim (world units). Stops a slow koi from coiling over itself at its target. */
export const MIN_TURN_RADIUS = 0.3;
const MIN_SPEED = 0.006;
const MAX_SPEED = 0.035;
const SPEED_GAIN = 0.035;

/**
 * Drags a chain after its head: `points[0]` becomes `head` and every following point is pulled along the line
 * to its predecessor until it is exactly `segLen` away. In place, no allocations.
 */
export function followChain(points: Vec3[], head: Vec3, segLen: number): void {
  if (points.length === 0) return;
  points[0].x = head.x;
  points[0].y = head.y;
  points[0].z = head.z;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let dz = b.z - a.z;
    let d = Math.hypot(dx, dy, dz);
    if (d < 1e-9) {
      // Two points on top of each other have no direction: trail straight back along -x.
      dx = -1;
      dy = 0;
      dz = 0;
      d = 1;
    }
    const k = segLen / d;
    b.x = a.x + dx * k;
    b.y = a.y + dy * k;
    b.z = a.z + dz * k;
  }
}

/**
 * One step of swimming towards `target` on the water plane (x/z). Turns at most `MAX_TURN` per frame and moves at
 * `clamp(dist * 0.035, 0.006, 0.035) * (1 + 0.8 * morph)`. `scale` is the frame time in 60 Hz frames, so the speed
 * does not depend on the display refresh rate. Writes into `out` when given (no allocation).
 */
export function steer(head: Vec3, heading: number, target: Vec3, morph: number, scale = 1, out?: SteerState): SteerState {
  const dx = target.x - head.x;
  const dz = target.z - head.z;
  const dist = Math.hypot(dx, dz);
  let da = Math.atan2(dz, dx) - heading;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  const step = clamp(dist * SPEED_GAIN, MIN_SPEED, MAX_SPEED) * (1 + 0.8 * morph);
  const maxTurn = Math.min(MAX_TURN, step / MIN_TURN_RADIUS) * scale;
  const nextHeading = heading + clamp(da, -maxTurn, maxTurn);
  const speed = step * scale;
  const res = out ?? { head: { x: 0, y: 0, z: 0 }, heading: 0 };
  res.head.x = head.x + Math.cos(nextHeading) * speed;
  res.head.y = head.y;
  res.head.z = head.z + Math.sin(nextHeading) * speed;
  res.heading = nextHeading;
  return res;
}

/** Where the creature wanders while nobody points at the water: a slow figure of eight, wider for the dragon. */
export function idleTarget(t: number, morph: number, out: Vec3): Vec3 {
  out.x = Math.sin(t * 0.42) * lerp(2.0, 2.6, morph);
  out.y = 0;
  out.z = Math.sin(t * 0.84) * lerp(1.1, 1.5, morph);
  return out;
}

const newFrame = (): Frame => ({ T: { x: 1, y: 0, z: 0 }, S: { x: 0, y: 0, z: 1 }, U: { x: 0, y: 1, z: 0 } });

/**
 * A frame per spine point, with world up (0, 1, 0) as the reference so the back always faces the sky:
 * `T = normalize(p[i-1] - p[i+1])`, `S = normalize(T x UP)`, `U = normalize(S x T)`. Reuses `out` when given.
 */
export function buildFrames(points: Vec3[], out: Frame[] = []): Frame[] {
  const n = points.length;
  while (out.length < n) out.push(newFrame());
  out.length = n;
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    const { T, S, U } = out[i];
    let tx = a.x - b.x;
    let ty = a.y - b.y;
    let tz = a.z - b.z;
    let tl = tx * tx + ty * ty + tz * tz;
    if (tl < 1e-10) {
      tx = 1;
      ty = 0;
      tz = 0;
      tl = 1;
    }
    tl = Math.sqrt(tl);
    tx /= tl;
    ty /= tl;
    tz /= tl;
    // S = T x (0, 1, 0)
    let sx = -tz;
    let sz = tx;
    let sl = Math.hypot(sx, sz);
    if (sl < 1e-4) {
      sx = 0;
      sz = 1;
      sl = 1;
    }
    sx /= sl;
    sz /= sl;
    // U = S x T (S has no y component)
    const ux = -sz * ty;
    const uy = sz * tx - sx * tz;
    const uz = sx * ty;
    const ul = Math.hypot(ux, uy, uz) || 1;
    T.x = tx;
    T.y = ty;
    T.z = tz;
    S.x = sx;
    S.y = 0;
    S.z = sz;
    U.x = ux / ul;
    U.y = uy / ul;
    U.z = uz / ul;
  }
  return out;
}
