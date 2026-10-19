import { describe, expect, it } from "vitest";
import { bodyLength, KOI_LENGTH } from "@/scene/creature/profiles";
import {
  followChain,
  idleModeForChapter,
  idleTarget,
  MIN_TURN_RADIUS,
  minTurnRadius,
  ORBIT_CENTRE_X,
  ORBIT_Z,
  pondLimits,
  REF_ASPECT,
  steer,
  type Vec3,
} from "@/scene/creature/spine";

const v = (x: number, y = 0, z = 0): Vec3 => ({ x, y, z });
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe("minTurnRadius", () => {
  it("is the koi radius for a koi and grows with the body length", () => {
    expect(minTurnRadius(0)).toBeCloseTo(MIN_TURN_RADIUS, 10);
    expect(minTurnRadius(1)).toBeCloseTo(
      (MIN_TURN_RADIUS * bodyLength(1)) / KOI_LENGTH,
      10,
    );
    expect(minTurnRadius(0.5)).toBeGreaterThan(minTurnRadius(0));
    expect(minTurnRadius(1)).toBeGreaterThan(minTurnRadius(0.5));
  });
});

describe("steer with a morph-scaled turning circle", () => {
  it("never circles tighter than minTurnRadius(morph), for the dragon too", () => {
    for (const morph of [0, 0.5, 1]) {
      const r = steer(v(0), 0, v(0.001, 0, 0.05), morph);
      const speed = dist(r.head, v(0));
      expect(speed / Math.abs(r.heading)).toBeGreaterThanOrEqual(
        minTurnRadius(morph) - 1e-9,
      );
    }
  });

  it("a dragon resting at its target does not wrap its body through itself", () => {
    const N = 110;
    const seg = bodyLength(1) / (N - 1);
    let s = { head: v(0), heading: 0 };
    const chain = Array.from({ length: N }, (_, i) => v(-i * seg));
    const target = v(1.2, 0, 0.8);
    let closest = Infinity;
    for (let f = 0; f < 2400; f++) {
      s = steer(s.head, s.heading, target, 1);
      followChain(chain, s.head, seg);
      if (f < 1500) continue;
      // Body points more than 2 units of arc length behind the head must stay clear of the head.
      for (let i = Math.ceil(2 / seg); i < N; i++)
        closest = Math.min(closest, dist(chain[0], chain[i]));
    }
    // The dragon head is about 0.17 wide and its tail tip 0.02: the head must clear the rest of the body by more.
    expect(closest).toBeGreaterThan(0.25);
  });

  it("a tighter turning circle (radiusScale) lets the head reach a pellet inside the normal circle", () => {
    const reach = (radiusScale: number) => {
      let s = { head: v(0), heading: 0 };
      let best = Infinity;
      // A target the head cannot reach with the normal 0.3 circle: 0.15 to its side, just ahead.
      const target = v(0.05, 0, 0.12);
      for (let f = 0; f < 600; f++) {
        s = steer(s.head, s.heading, target, 0, 1, undefined, radiusScale);
        best = Math.min(best, dist(s.head, target));
      }
      return best;
    };
    expect(reach(1)).toBeGreaterThan(0.015);
    expect(reach(0.4)).toBeLessThan(0.15);
  });

  it("a koi chasing a pellet always gets within the eating radius, from any heading", () => {
    for (let k = 0; k < 24; k++) {
      const heading = (k / 24) * Math.PI * 2;
      let s = { head: v(0), heading };
      const target = v(Math.cos(k) * 0.6, 0, Math.sin(k * 1.7) * 0.6);
      let best = Infinity;
      for (let f = 0; f < 900; f++) {
        s = steer(s.head, s.heading, target, 0, 1, undefined, 0.4);
        best = Math.min(best, dist(s.head, target));
      }
      expect(best).toBeLessThan(0.15);
    }
  });
});

describe("pondLimits", () => {
  it("keeps today's extents on landscape screens", () => {
    const l = pondLimits(REF_ASPECT, 0);
    expect(l.idleX).toBeCloseTo(2.0, 10);
    expect(l.idleZ).toBeCloseTo(1.1, 10);
    expect(l.pointerX).toBeCloseTo(4.5, 10);
    expect(l.zMin).toBeCloseTo(-3, 10);
    expect(l.zMax).toBeCloseTo(1.6, 10);
    expect(pondLimits(2.4, 0).idleX).toBeCloseTo(2.0, 10);
  });

  it("widens for the dragon", () => {
    expect(pondLimits(REF_ASPECT, 1).idleX).toBeCloseTo(2.6, 10);
    expect(pondLimits(REF_ASPECT, 1).idleZ).toBeCloseTo(1.5, 10);
  });

  it("narrows with the screen width so a portrait phone keeps the koi on screen", () => {
    const phone = pondLimits(390 / 844, 0);
    const tablet = pondLimits(0.75, 0);
    expect(phone.idleX).toBeLessThan(tablet.idleX);
    expect(tablet.idleX).toBeLessThan(2.0);
    expect(phone.pointerX).toBeLessThan(2);
    expect(phone.idleX).toBeGreaterThan(0.3);
    expect(pondLimits(0.01, 0).idleX).toBeGreaterThan(0);
  });
});

describe("idleTarget on a narrow screen", () => {
  it("stays inside the aspect-aware limits", () => {
    const out = v(0);
    const aspect = 390 / 844;
    const limits = pondLimits(aspect, 0);
    for (let t = 0; t < 60; t += 0.1) {
      idleTarget(t, 0, out, { aspect });
      expect(Math.abs(out.x)).toBeLessThanOrEqual(limits.idleX + 1e-9);
      expect(Math.abs(out.z)).toBeLessThanOrEqual(limits.idleZ + 1e-9);
    }
  });

  it("keeps the old figure of eight when called without options", () => {
    const out = v(0);
    idleTarget(Math.PI / 2 / 0.42, 0, out);
    expect(out.x).toBeCloseTo(2.0, 6);
  });
});

describe("idle modes per chapter", () => {
  it("swims through the gate in chapter 5 and orbits the contact block in chapter 6", () => {
    expect(idleModeForChapter(0)).toBe("eight");
    expect(idleModeForChapter(3)).toBe("eight");
    expect(idleModeForChapter(5)).toBe("gate");
    expect(idleModeForChapter(6)).toBe("orbit");
  });

  it("gate: a line across the gate opening; orbit: a ring round the call to action, right of the middle", () => {
    const out = v(0);
    let zMin = Infinity;
    let zMax = -Infinity;
    let xMax = 0;
    for (let t = 0; t < 60; t += 0.1) {
      idleTarget(t, 0.5, out, { mode: "gate" });
      zMin = Math.min(zMin, out.z);
      zMax = Math.max(zMax, out.z);
      xMax = Math.max(xMax, Math.abs(out.x));
    }
    expect(zMax - zMin).toBeLessThan(0.7);
    expect(xMax).toBeGreaterThan(1.5);

    const radii: number[] = [];
    const limits = pondLimits(REF_ASPECT, 1);
    for (let t = 0; t < 60; t += 0.5) {
      idleTarget(t, 1, out, { mode: "orbit" });
      radii.push(
        Math.hypot(
          out.x - limits.idleX * ORBIT_CENTRE_X,
          (out.z - ORBIT_Z) / 0.55,
        ),
      );
    }
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1e-6);
  });
});
