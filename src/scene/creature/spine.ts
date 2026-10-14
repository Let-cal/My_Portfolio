import { REF_ASPECT } from "../environment/constants";
import { bodyLength, clamp, KOI_LENGTH, lerp } from "./profiles";

/** A point or direction. Structurally compatible with `THREE.Vector3`, so the scene can pass its own vectors. */
export type Vec3 = { x: number; y: number; z: number };

/** Moving frame along the spine: `T` points towards the head, `S` to the creature's right side, `U` up. */
export type Frame = { T: Vec3; S: Vec3; U: Vec3 };

export type SteerState = { head: Vec3; heading: number };

/** Largest turn per 60 Hz frame (radians). */
export const MAX_TURN = 0.06;
/** Tightest circle a koi's head may swim (world units). Stops a slow koi from coiling over itself at its target. */
export const MIN_TURN_RADIUS = 0.3;

/**
 * Tightest circle the head may swim at this morph. It grows with the body, in proportion to `bodyLength`: a 6.2 long
 * dragon that circled as tightly as a 1.7 long koi would wrap its body through itself.
 */
export function minTurnRadius(morph: number): number {
  return (MIN_TURN_RADIUS * bodyLength(morph)) / KOI_LENGTH;
}
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
 * `clamp(dist * 0.035, 0.006, 0.035) * (1 + 0.8 * morph)`, on a circle no tighter than `minTurnRadius(morph)` times
 * `radiusScale` (a koi darting at a pellet uses less than 1, so it can reach one inside its usual turning circle).
 * `scale` is the frame time in 60 Hz frames, so the speed does not depend on the display refresh rate. Writes into
 * `out` when given (no allocation).
 */
export function steer(
  head: Vec3,
  heading: number,
  target: Vec3,
  morph: number,
  scale = 1,
  out?: SteerState,
  radiusScale = 1,
): SteerState {
  const dx = target.x - head.x;
  const dz = target.z - head.z;
  const dist = Math.hypot(dx, dz);
  let da = Math.atan2(dz, dx) - heading;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  const step = clamp(dist * SPEED_GAIN, MIN_SPEED, MAX_SPEED) * (1 + 0.8 * morph);
  const maxTurn = Math.min(MAX_TURN, step / (minTurnRadius(morph) * radiusScale)) * scale;
  const nextHeading = heading + clamp(da, -maxTurn, maxTurn);
  const speed = step * scale;
  const res = out ?? { head: { x: 0, y: 0, z: 0 }, heading: 0 };
  res.head.x = head.x + Math.cos(nextHeading) * speed;
  res.head.y = head.y;
  res.head.z = head.z + Math.sin(nextHeading) * speed;
  res.heading = nextHeading;
  return res;
}

export { REF_ASPECT };
/** Narrowest the pond gets, as a share of its landscape width, however thin the screen is. */
const MIN_WIDTH_SHARE = 0.28;

export type PondLimits = {
  /** Half-width and half-depth of the idle figure. */
  idleX: number;
  idleZ: number;
  /** Half-width the pointer target is clamped to. */
  pointerX: number;
  /** Nearest and farthest depth the pointer target may take: never right under the camera. */
  zMin: number;
  zMax: number;
};

/**
 * Where the creature may go, for a screen of this `aspect` (width / height). On landscape screens this is the pond of
 * the prototype; on portrait ones the width shrinks with the screen so the koi stays in view, since the camera sees
 * proportionally less sideways. Wider for the dragon, which is longer.
 */
export function pondLimits(
  aspect: number,
  morph: number,
  out: PondLimits = { idleX: 0, idleZ: 0, pointerX: 0, zMin: 0, zMax: 0 },
): PondLimits {
  const share = clamp(aspect / REF_ASPECT, MIN_WIDTH_SHARE, 1);
  out.idleX = lerp(2.0, 2.6, morph) * share;
  out.idleZ = lerp(1.1, 1.5, morph);
  out.pointerX = 4.5 * share;
  out.zMin = -3;
  out.zMax = 1.6;
  return out;
}

export type IdleMode = "eight" | "gate" | "orbit";
/** The contact chapter's ring is centred this many half-widths of the pond right of the middle, and this deep. */
export const ORBIT_CENTRE_X = 1.2;
export const ORBIT_Z = 0.3;
/** Depth of the gate (chapter 5) the creature swims through. */
export const GATE_Z = -1.4;

/** How the creature wanders in a chapter: a figure of eight, back and forth through the gate, or circling the contact block. */
export function idleModeForChapter(chapter: number): IdleMode {
  if (chapter === 5) return "gate";
  if (chapter >= 6) return "orbit";
  return "eight";
}

const limitsScratch: PondLimits = { idleX: 0, idleZ: 0, pointerX: 0, zMin: 0, zMax: 0 };

/**
 * Where the creature wanders while nobody points at the water. By default a slow figure of eight, wider for the dragon
 * and narrower on a portrait screen (`opts.aspect`); `opts.mode` picks the chapter's variation. No allocation.
 */
export function idleTarget(t: number, morph: number, out: Vec3, opts: { aspect?: number; mode?: IdleMode } = {}): Vec3 {
  const limits = pondLimits(opts.aspect ?? REF_ASPECT, morph, limitsScratch);
  out.y = 0;
  switch (opts.mode) {
    case "gate":
      out.x = Math.sin(t * 0.5) * limits.idleX * 1.1;
      out.z = GATE_Z + Math.sin(t * 1.3) * 0.2;
      break;
    case "orbit": {
      // Round the call to action, which sits to the right of the headline: a ring centred right of the middle.
      const rx = limits.idleX * 0.8;
      out.x = limits.idleX * ORBIT_CENTRE_X + Math.cos(t * 0.45) * rx;
      out.z = ORBIT_Z + Math.sin(t * 0.45) * rx * 0.55;
      break;
    }
    default:
      out.x = Math.sin(t * 0.42) * limits.idleX;
      out.z = Math.sin(t * 0.84) * limits.idleZ;
  }
  return out;
}

/** Angular speed of the guardian dragon's circuit (radians per second). */
export const ORBIT_SPEED = 0.45;
/** The orbit is an ellipse: its depth (z) is this share of its width (x), so the circuit reads as a ring from the high camera. */
export const ORBIT_DEPTH = 0.6;

/**
 * A point on the guardian dragon's ellipse round `center`: `radius` wide along x, `radius * 0.6` deep along z, at the
 * centre's height, going once round every `2pi / ORBIT_SPEED` seconds. The dragon's head chases it. Writes into `out`
 * when given (no allocation).
 */
export function orbitTarget(center: Vec3, time: number, radius: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const a = time * ORBIT_SPEED;
  out.x = center.x + Math.cos(a) * radius;
  out.y = center.y;
  out.z = center.z + Math.sin(a) * radius * ORBIT_DEPTH;
  return out;
}

/** Tightest and widest ring (world units) the guardian dragon circles the call to action on. */
const GUARDIAN_MIN = 3;
const GUARDIAN_MAX = 3.6;

/**
 * Half-width of the guardian dragon's ring for a call to action whose own radius on the water is `ctaRadius`:
 * clear of the button (twice its radius), wide enough that the ends of the ellipse (they curve with radius 0.36 r) are not
 * tighter than the dragon can turn, and not so wide it leaves the pond.
 */
export function guardianRadius(ctaRadius: number): number {
  const r = Number.isFinite(ctaRadius) ? ctaRadius : 0;
  return clamp(r * 2 + 0.35, GUARDIAN_MIN, GUARDIAN_MAX);
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
