import { describe, expect, it } from "vitest";
import {
  createBodyGeometry,
  writeBody,
  bodyVertexCount,
  CAP_RINGS,
} from "@/scene/creature/geometry";
import {
  bodyLength,
  dragonRadius,
  koiRadius,
  ringRadii,
} from "@/scene/creature/profiles";
import {
  buildFrames,
  followChain,
  idleTarget,
  steer,
  MAX_TURN,
  MIN_TURN_RADIUS,
  type Vec3,
} from "@/scene/creature/spine";
import {
  circuitLayout,
  koiPatchLayout,
  mulberry32,
} from "@/scene/creature/textures";
import { varietyForRole, qualityForTier } from "@/scene/creature/config";

const v = (x: number, y = 0, z = 0): Vec3 => ({ x, y, z });
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const samples = (n: number) => Array.from({ length: n + 1 }, (_, i) => i / n);

describe("body profiles", () => {
  it("the koi widens from the snout to the shoulder", () => {
    expect(koiRadius(0)).toBeLessThan(koiRadius(0.3));
  });

  it("matches the prototype formula (koi x1.25)", () => {
    // u = 0.3: f = 1, sqrt(min(1, 6.2)) = 1.
    expect(koiRadius(0.3)).toBeCloseTo(1.25 * 0.225, 10);
    expect(koiRadius(1)).toBeCloseTo(1.25 * 0.025, 10);
    expect(dragonRadius(0.04)).toBeCloseTo(
      0.17 * Math.sqrt(Math.min(1, 0.04 / 0.03 + 0.3)),
      10,
    );
  });

  it("the dragon tapers all the way from the neck to the tail", () => {
    const us = samples(200).filter((u) => u >= 0.1);
    for (let i = 1; i < us.length; i++)
      expect(dragonRadius(us[i])).toBeLessThan(dragonRadius(us[i - 1]));
  });

  it("both profiles stay positive over the whole body", () => {
    for (const u of samples(400)) {
      expect(koiRadius(u)).toBeGreaterThan(0);
      expect(dragonRadius(u)).toBeGreaterThan(0);
    }
  });

  it("the body grows from 1.7 (koi) to 6.2 (dragon)", () => {
    expect(bodyLength(0)).toBeCloseTo(1.7, 10);
    expect(bodyLength(1)).toBeCloseTo(6.2, 10);
    expect(bodyLength(0.5)).toBeCloseTo(3.95, 10);
  });

  it("ring radii blend the two profiles; the koi is flatter than the dragon", () => {
    const out = { rx: 0, ry: 0 };
    ringRadii(0.3, 0, out);
    expect(out.rx).toBeCloseTo(koiRadius(0.3), 10);
    expect(out.ry).toBeCloseTo(koiRadius(0.3) * 0.72, 10);
    ringRadii(0.3, 1, out);
    expect(out.rx).toBeCloseTo(dragonRadius(0.3), 10);
    expect(out.ry).toBeCloseTo(dragonRadius(0.3) * 0.95, 10);
  });
});

describe("followChain", () => {
  it("keeps every link exactly segLen long after the head moves", () => {
    const pts = Array.from({ length: 40 }, (_, i) => v(-i * 0.015));
    const head = v(0.3, 0, -0.2);
    followChain(pts, head, 0.02);
    expect(pts[0]).toEqual(head);
    for (let i = 1; i < pts.length; i++)
      expect(Math.abs(dist(pts[i], pts[i - 1]) - 0.02)).toBeLessThan(1e-6);
  });

  it("copes with points sitting on top of each other", () => {
    const pts = Array.from({ length: 5 }, () => v(1, 0, 1));
    followChain(pts, v(1, 0, 1), 0.05);
    for (let i = 1; i < pts.length; i++)
      expect(Math.abs(dist(pts[i], pts[i - 1]) - 0.05)).toBeLessThan(1e-6);
  });

  it("stretches and shrinks the chain when the segment length changes (koi to dragon)", () => {
    const pts = Array.from({ length: 10 }, (_, i) => v(-i * 0.01));
    followChain(pts, v(0), 0.3);
    for (let i = 1; i < pts.length; i++)
      expect(Math.abs(dist(pts[i], pts[i - 1]) - 0.3)).toBeLessThan(1e-6);
  });
});

describe("steer", () => {
  it("never turns more than 0.06 rad in a frame, whatever the target", () => {
    let head = v(0);
    let heading = 0;
    const targets = [
      v(-3, 0, 0.01),
      v(0, 0, 5),
      v(-1, 0, -1),
      v(2, 0, 2),
      v(0.001, 0, -0.001),
    ];
    for (let f = 0; f < 200; f++) {
      const r = steer(head, heading, targets[f % targets.length], 0.3);
      const turn = Math.atan2(
        Math.sin(r.heading - heading),
        Math.cos(r.heading - heading),
      );
      expect(Math.abs(turn)).toBeLessThanOrEqual(MAX_TURN + 1e-12);
      head = r.head;
      heading = r.heading;
    }
  });

  it("moves at clamp(dist*0.035, 0.006, 0.035) * (1 + 0.8*morph) along the new heading", () => {
    const far = steer(v(0), 0, v(10), 0);
    expect(dist(far.head, v(0))).toBeCloseTo(0.035, 10);
    const near = steer(v(0), 0, v(0.05), 0);
    expect(dist(near.head, v(0))).toBeCloseTo(0.006, 10);
    const mid = steer(v(0), 0, v(0.5), 0);
    expect(dist(mid.head, v(0))).toBeCloseTo(0.0175, 10);
    const dragon = steer(v(0), 0, v(10), 1);
    expect(dist(dragon.head, v(0))).toBeCloseTo(0.035 * 1.8, 10);
    expect(dragon.head.z).toBeCloseTo(0, 10);
  });

  it("turns towards the target on the shorter side", () => {
    const left = steer(v(0), 0, v(1, 0, 1), 0);
    expect(left.heading).toBeCloseTo(0.06, 10);
    const right = steer(v(0), 0, v(1, 0, -1), 0);
    expect(right.heading).toBeCloseTo(-0.06, 10);
    // Heading pi, target at angle -pi + 0.01: the short way round is +0.01 through pi, not -6.27.
    const wrap = steer(v(0), Math.PI, v(-1, 0, -0.01), 0);
    expect(Math.abs(wrap.heading - Math.PI)).toBeLessThan(0.02);
  });

  it("scales with the frame time and can write into a reused object", () => {
    const out = { head: v(0), heading: 0 };
    const r = steer(v(0), 0, v(0, 0, 10), 0, 2, out);
    expect(r).toBe(out);
    expect(out.heading).toBeCloseTo(0.12, 10);
    expect(len(out.head)).toBeCloseTo(0.07, 10);
  });

  it("never circles tighter than MIN_TURN_RADIUS, so a slow koi at its target does not fold over itself", () => {
    // At the target the speed is the 0.006 minimum: 0.06 rad/frame would be a 0.1-wide circle.
    const r = steer(v(0), 0, v(0.001, 0, 0.05), 0);
    const speed = dist(r.head, v(0));
    expect(speed).toBeCloseTo(0.006, 10);
    expect(speed / Math.abs(r.heading)).toBeGreaterThanOrEqual(
      MIN_TURN_RADIUS - 1e-9,
    );
  });

  it("swims the head onto the target and keeps it close", () => {
    let s = { head: v(0), heading: 0 };
    const target = v(-1.5, 0, 1);
    let worst = 0;
    for (let f = 0; f < 900; f++) {
      s = steer(s.head, s.heading, target, 0);
      // Once it has arrived it orbits the target, never further than one turning circle across.
      if (f >= 600) worst = Math.max(worst, dist(s.head, target));
    }
    expect(worst).toBeLessThan(2 * MIN_TURN_RADIUS + 0.05);
  });
});

describe("buildFrames", () => {
  const pts = [
    v(1),
    v(0.5, 0, 0.1),
    v(0, 0, 0.3),
    v(-0.5, 0, 0.2),
    v(-1, 0, 0),
  ];

  it("gives an orthonormal frame per point with T pointing towards the head and U up", () => {
    const frames = buildFrames(pts);
    expect(frames).toHaveLength(pts.length);
    for (const { T, S, U } of frames) {
      expect(len(T)).toBeCloseTo(1, 9);
      expect(len(S)).toBeCloseTo(1, 9);
      expect(len(U)).toBeCloseTo(1, 9);
      expect(dot(T, S)).toBeCloseTo(0, 9);
      expect(dot(T, U)).toBeCloseTo(0, 9);
      expect(dot(S, U)).toBeCloseTo(0, 9);
      expect(U.y).toBeGreaterThan(0.99);
    }
    // Same convention as the prototype: T = p[i-1] - p[i+1], S = T x UP.
    expect(frames[0].T.x).toBeGreaterThan(0.9);
    expect(frames[0].S.z).toBeCloseTo(frames[0].T.x, 9);
  });

  it("falls back to a sane frame on a degenerate spine and reuses the output array", () => {
    const flat = [v(0), v(0), v(0)];
    const out = buildFrames(flat);
    for (const { T, S, U } of out) {
      expect(len(T)).toBeCloseTo(1, 9);
      expect(len(S)).toBeCloseTo(1, 9);
      expect(len(U)).toBeCloseTo(1, 9);
    }
    const again = buildFrames(pts, out);
    expect(again).toBe(out);
    expect(again).toHaveLength(pts.length);
    expect(again[0].T.x).toBeGreaterThan(0.9);
  });
});

describe("idleTarget", () => {
  it("wanders a lissajous inside the pond and widens for the dragon", () => {
    const out = v(0);
    let maxX = 0;
    let maxZ = 0;
    for (let t = 0; t < 40; t += 0.05) {
      idleTarget(t, 0, out);
      maxX = Math.max(maxX, Math.abs(out.x));
      maxZ = Math.max(maxZ, Math.abs(out.z));
      expect(out.y).toBe(0);
    }
    expect(maxX).toBeLessThanOrEqual(2.0 + 1e-9);
    expect(maxX).toBeGreaterThan(1.9);
    expect(maxZ).toBeLessThanOrEqual(1.1 + 1e-9);
    idleTarget(Math.PI / 2 / 0.42, 1, out);
    expect(out.x).toBeCloseTo(2.6, 6);
  });
});

describe("seeded textures", () => {
  it("mulberry32 is deterministic and in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(42)());
  });

  it("koiPatchLayout is the same on every call for a variety", () => {
    for (const variety of ["kohaku", "showa", "ogon"] as const) {
      expect(koiPatchLayout(variety)).toEqual(koiPatchLayout(variety));
    }
  });

  it("each variety has its own look: kohaku red on white, showa adds black, ogon is plain gold", () => {
    const kohaku = koiPatchLayout("kohaku");
    const showa = koiPatchLayout("showa");
    const ogon = koiPatchLayout("ogon");
    expect(kohaku.patches.length).toBeGreaterThanOrEqual(4);
    expect(new Set(kohaku.patches.map((p) => p.tone))).toEqual(new Set(["hi"]));
    expect(new Set(showa.patches.map((p) => p.tone))).toEqual(
      new Set(["hi", "sumi"]),
    );
    expect(ogon.patches).toHaveLength(0);
    expect(kohaku.base).not.toBe(ogon.base);
  });

  it("kohaku keeps its red on the back: the belly and the tail end stay white", () => {
    for (const p of koiPatchLayout("kohaku").patches) {
      for (let i = 0; i < p.points.length; i += 2) {
        const u = p.points[i];
        const v = p.points[i + 1];
        expect(u).toBeLessThan(0.86);
        // v = 0.25 is the middle of the back, 0.75 the belly.
        expect(Math.abs(v - 0.25)).toBeLessThan(0.32);
      }
    }
  });

  it("circuitLayout is deterministic and its traces stay inside the texture", () => {
    const a = circuitLayout();
    expect(a).toEqual(circuitLayout());
    expect(a.length).toBeGreaterThan(30);
    for (const trace of a) {
      expect(trace.phase).toBeGreaterThanOrEqual(0);
      expect(trace.phase).toBeLessThan(1);
      for (let i = 0; i < trace.points.length; i += 2) {
        expect(trace.points[i]).toBeGreaterThanOrEqual(0);
        expect(trace.points[i]).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("config", () => {
  it("maps each role to its koi variety", () => {
    expect(varietyForRole("fullstack")).toBe("kohaku");
    expect(varietyForRole("techlead")).toBe("showa");
    expect(varietyForRole("pm")).toBe("ogon");
  });

  it("uses 110x28 rings on the high tier and 72x18 on low", () => {
    expect(qualityForTier("high")).toMatchObject({ rings: 110, sides: 28 });
    expect(qualityForTier("low")).toMatchObject({ rings: 72, sides: 18 });
  });
});

describe("body geometry", () => {
  const N = 20;
  const M = 8;

  it("lays out rings (plus closed caps) with uv, normal and a seeded aRand attribute", () => {
    const g = createBodyGeometry(N, M);
    const count = bodyVertexCount(N, M);
    expect(count).toBe((N + 2 * CAP_RINGS) * (M + 1));
    for (const name of ["position", "normal", "uv", "aRand"])
      expect(g.getAttribute(name).count).toBe(count);
    expect(g.getIndex()!.count).toBe((N + 2 * CAP_RINGS - 1) * M * 6);
    // Deterministic, so the point-cloud dissolve looks the same on every visit.
    expect(
      Array.from(createBodyGeometry(N, M).getAttribute("aRand").array),
    ).toEqual(Array.from(g.getAttribute("aRand").array));
    const uv = g.getAttribute("uv");
    expect(uv.getX(CAP_RINGS * (M + 1))).toBe(0);
    expect(uv.getX((CAP_RINGS + N - 1) * (M + 1))).toBe(1);
    g.dispose();
  });

  it("writes a closed tube around the spine with unit outward normals", () => {
    const g = createBodyGeometry(N, M);
    const pts = Array.from({ length: N }, (_, i) => v(-i * 0.1));
    const frames = buildFrames(pts);
    const rx = new Float32Array(N).fill(0.2);
    const ry = new Float32Array(N).fill(0.1);
    writeBody(g, pts, frames, rx, ry, 1);
    const pos = g.getAttribute("position");
    const nor = g.getAttribute("normal");
    for (let k = 0; k < pos.count; k++) {
      expect(Number.isFinite(pos.getX(k) + pos.getY(k) + pos.getZ(k))).toBe(
        true,
      );
      expect(Math.hypot(nor.getX(k), nor.getY(k), nor.getZ(k))).toBeCloseTo(
        1,
        5,
      );
    }
    // A body ring vertex at angle 0 sits rx out along S (+z here), its normal points out too.
    const k = (CAP_RINGS + 5) * (M + 1);
    expect(pos.getZ(k)).toBeCloseTo(0.2, 5);
    expect(nor.getZ(k)).toBeGreaterThan(0.99);
    // The seam column duplicates column 0.
    expect(pos.getZ(k + M)).toBeCloseTo(pos.getZ(k), 6);
    // The nose cap closes in front of ring 0, the tail cap behind the last ring.
    const tip = 0;
    expect(pos.getX(tip)).toBeGreaterThan(0);
    expect(Math.hypot(pos.getY(tip), pos.getZ(tip))).toBeLessThan(1e-6);
    const tail = (N + 2 * CAP_RINGS - 1) * (M + 1);
    expect(pos.getX(tail)).toBeLessThan(pts[N - 1].x);
    g.dispose();
  });
});
