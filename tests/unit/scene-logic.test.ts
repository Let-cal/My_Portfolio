import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChapterProgress, scatterAt, transformState } from "@/scene/chapters";
import { cloudIndices } from "@/scene/creature/cloud";
import { CAP_RINGS } from "@/scene/creature/geometry";
import { orbitTarget, ORBIT_SPEED, guardianRadius } from "@/scene/creature/spine";
import { shouldLoadScene } from "@/scene/loading";
import { createSceneStore, sceneStore } from "@/scene/store";
import { detectTier, shouldDowngrade } from "@/scene/tier";

const base = { webgl: true, reducedMotion: false, isMobile: false, cores: 8 };

describe("detectTier", () => {
  it("is off without WebGL", () => expect(detectTier({ ...base, webgl: false })).toBe("off"));
  it("is off with reduced motion", () => expect(detectTier({ ...base, reducedMotion: true })).toBe("off"));
  it("off wins over mobile and low core counts", () => {
    expect(detectTier({ webgl: false, reducedMotion: false, isMobile: true, cores: 2 })).toBe("off");
  });
  it("is low on mobile", () => expect(detectTier({ ...base, isMobile: true })).toBe("low"));
  it("is low with 4 cores or fewer", () => {
    expect(detectTier({ ...base, cores: 4 })).toBe("low");
    expect(detectTier({ ...base, cores: 1 })).toBe("low");
  });
  it("is high on a desktop with 5+ cores", () => {
    expect(detectTier(base)).toBe("high");
    expect(detectTier({ ...base, cores: 5 })).toBe("high");
  });
});

describe("shouldDowngrade", () => {
  it("needs 60 samples averaging under 40 fps", () => {
    expect(shouldDowngrade(Array(60).fill(30))).toBe(true);
    expect(shouldDowngrade(Array(120).fill(39.9))).toBe(true);
  });
  it("ignores too few samples, however slow", () => {
    expect(shouldDowngrade(Array(30).fill(10))).toBe(false);
    expect(shouldDowngrade(Array(59).fill(1))).toBe(false);
    expect(shouldDowngrade([])).toBe(false);
  });
  it("keeps a smooth scene", () => {
    expect(shouldDowngrade(Array(60).fill(60))).toBe(false);
    expect(shouldDowngrade(Array(60).fill(40))).toBe(false);
  });
});

describe("shouldLoadScene", () => {
  const desktop = { tier: "high" as const, isMobile: false, interacted: false, idleMs: 0, pageLoaded: false };
  it("never loads when the tier is off", () => {
    expect(shouldLoadScene({ ...desktop, tier: "off", pageLoaded: true, interacted: true, idleMs: 9000 })).toBe(false);
    expect(shouldLoadScene({ ...desktop, tier: "off", isMobile: true, interacted: true })).toBe(false);
  });
  it("loads on desktop once the page has loaded", () => {
    expect(shouldLoadScene(desktop)).toBe(false);
    expect(shouldLoadScene({ ...desktop, pageLoaded: true })).toBe(true);
    expect(shouldLoadScene({ ...desktop, tier: "low", pageLoaded: true })).toBe(true);
  });
  it("ignores interaction and idle time on desktop", () => {
    expect(shouldLoadScene({ ...desktop, interacted: true, idleMs: 5000 })).toBe(false);
  });
  it("loads on mobile after the first interaction or 3s idle, not on page load alone", () => {
    const mobile = { ...desktop, tier: "low" as const, isMobile: true, pageLoaded: true };
    expect(shouldLoadScene(mobile)).toBe(false);
    expect(shouldLoadScene({ ...mobile, interacted: true })).toBe(true);
    expect(shouldLoadScene({ ...mobile, idleMs: 2999 })).toBe(false);
    expect(shouldLoadScene({ ...mobile, idleMs: 3000 })).toBe(true);
  });
});

describe("getChapterProgress", () => {
  const tops = [0, 800, 1600];
  it("starts at chapter 0, t 0", () => expect(getChapterProgress(0, tops, 800)).toEqual({ chapter: 0, t: 0 }));
  it("switches chapter when a section top crosses the middle of the viewport", () => {
    expect(getChapterProgress(399, tops, 800).chapter).toBe(0);
    expect(getChapterProgress(400, tops, 800).chapter).toBe(1);
    expect(getChapterProgress(1200, tops, 800).chapter).toBe(2);
  });
  it("measures t from the scroll position where the chapter began to where the next one begins", () => {
    // Chapter 0 runs from scrollY 0 to 400 (the next top reaches the middle), chapter 1 from 400 to 1200.
    expect(getChapterProgress(200, tops, 800)).toEqual({ chapter: 0, t: 0.5 });
    expect(getChapterProgress(600, tops, 800)).toEqual({ chapter: 1, t: 0.25 });
    expect(getChapterProgress(1000, tops, 800)).toEqual({ chapter: 1, t: 0.75 });
  });
  it("is 0 on entering a chapter and just under 1 on leaving it, so the story is continuous", () => {
    expect(getChapterProgress(400, tops, 800)).toEqual({ chapter: 1, t: 0 });
    const end = getChapterProgress(1199, tops, 800);
    expect(end.chapter).toBe(1);
    expect(end.t).toBeGreaterThan(0.99);
    expect(getChapterProgress(1200, tops, 800)).toEqual({ chapter: 2, t: 0 });
  });
  it("lets a section shorter than half a screen still run from 0 to 1 before the next one", () => {
    // Chapter 5 is only 300 px tall: scrolling from 4600 - 400 to 4900 - 400 must cover all of t.
    const short = [0, 1000, 2000, 3000, 4000, 4600, 4900];
    const at = (y: number) => getChapterProgress(y, short, 800);
    expect(at(4200)).toEqual({ chapter: 5, t: 0 });
    expect(at(4350).t).toBeCloseTo(0.5, 6);
    expect(at(4499).t).toBeGreaterThan(0.99);
    // The old measure (scrollY - top) / span was 0 through this whole section: the morph (t >= 0.65) never came.
    expect(transformState(5, at(4499).t)).toEqual({ morph: 1, scatter: 0 });
    expect(transformState(5, at(4350).t).scatter).toBeGreaterThan(0.99);
  });
  it("clamps t to 1 and stays on the last chapter past the end", () => {
    expect(getChapterProgress(99999, tops, 800)).toEqual({ chapter: 2, t: 1 });
  });
  it("handles negative scroll (overscroll) and an empty list", () => {
    expect(getChapterProgress(-50, tops, 800)).toEqual({ chapter: 0, t: 0 });
    expect(getChapterProgress(500, [], 800)).toEqual({ chapter: 0, t: 0 });
  });
  it("stays on chapter 0 while every section is still below the middle line", () => {
    expect(getChapterProgress(0, [600, 1400], 800).chapter).toBe(0);
  });
  it("ignores a section that is missing from the page (infinite top) when sizing a chapter", () => {
    expect(getChapterProgress(500, [0, 400, Number.POSITIVE_INFINITY], 800).chapter).toBe(1);
    expect(getChapterProgress(99999, [0, 400, Number.POSITIVE_INFINITY], 800)).toEqual({ chapter: 1, t: 1 });
  });
});

describe("transformState", () => {
  it("is still a koi before chapter 5", () => {
    for (const c of [0, 1, 2, 3, 4]) expect(transformState(c, 1)).toEqual({ morph: 0, scatter: 0 });
  });
  it("holds the koi through the first 35% of chapter 5", () => {
    expect(transformState(5, 0)).toEqual({ morph: 0, scatter: 0 });
    expect(transformState(5, 0.35)).toEqual({ morph: 0, scatter: 0 });
  });
  it("scatters and morphs between 0.35 and 0.65", () => {
    const mid = transformState(5, 0.5);
    expect(mid.scatter).toBeCloseTo(1, 6);
    expect(mid.morph).toBeCloseTo(0.5, 6);
    const early = transformState(5, 0.35 + 0.3 / 6);
    expect(early.scatter).toBeCloseTo(0.5, 6);
    expect(early.morph).toBeCloseTo(1 / 6, 6);
  });
  it("is a dragon from 0.65 on, and in chapter 6", () => {
    expect(transformState(5, 0.65)).toEqual({ morph: 1, scatter: 0 });
    expect(transformState(5, 1)).toEqual({ morph: 1, scatter: 0 });
    expect(transformState(6, 0)).toEqual({ morph: 1, scatter: 0 });
  });
});

describe("scatterAt", () => {
  it("is 0 for a koi or a dragon and peaks at 1 halfway through the change", () => {
    expect(scatterAt(0)).toBe(0);
    expect(scatterAt(1)).toBeCloseTo(0, 12);
    expect(scatterAt(0.5)).toBe(1);
  });
  it("is symmetric, so the cloud gathers as it spread", () => {
    for (const m of [0.1, 0.25, 0.4]) expect(scatterAt(m)).toBeCloseTo(scatterAt(1 - m), 12);
  });
  it("is what transformState reports for a morph", () => {
    for (const t of [0.4, 0.5, 0.6]) {
      const s = transformState(5, t);
      expect(s.scatter).toBeCloseTo(scatterAt(s.morph), 12);
    }
  });
});

describe("orbitTarget", () => {
  const c = { x: 2, y: 0, z: -1 };
  it("starts on the x axis of the ellipse, radius away from the centre", () => {
    const p = orbitTarget(c, 0, 1.5);
    expect(p.x).toBeCloseTo(3.5, 12);
    expect(p.z).toBeCloseTo(-1, 12);
    expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeCloseTo(1.5, 12);
  });
  it("is an ellipse: x spans radius, z spans radius * 0.6, on the centre's height", () => {
    const quarter = Math.PI / 2 / ORBIT_SPEED;
    const p = orbitTarget(c, quarter, 2);
    expect(p.x).toBeCloseTo(2, 9);
    expect(p.z - c.z).toBeCloseTo(1.2, 9);
    for (let t = 0; t < 30; t += 0.7) {
      const q = orbitTarget({ x: 1, y: 0.4, z: 3 }, t, 2);
      expect(((q.x - 1) / 2) ** 2 + ((q.z - 3) / 1.2) ** 2).toBeCloseTo(1, 9);
      expect(q.y).toBe(0.4);
    }
  });
  it("is periodic and writes into `out` without allocating when given one", () => {
    const period = (Math.PI * 2) / ORBIT_SPEED;
    const a = orbitTarget(c, 1.3, 1);
    const b = orbitTarget(c, 1.3 + period, 1);
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(b.z).toBeCloseTo(a.z, 9);
    const out = { x: 0, y: 0, z: 0 };
    expect(orbitTarget(c, 1.3, 1, out)).toBe(out);
    expect(out.x).toBeCloseTo(a.x, 12);
  });
});

describe("guardianRadius", () => {
  it("keeps the dragon's ring outside the button and no tighter than it can turn", () => {
    expect(guardianRadius(0.1)).toBeGreaterThan(1.2);
    expect(guardianRadius(0.1)).toBeGreaterThan(0.1 * 2);
    expect(guardianRadius(0.9)).toBeGreaterThan(0.9 * 1.5);
    expect(guardianRadius(50)).toBeLessThanOrEqual(3.2);
    expect(guardianRadius(Number.NaN)).toBeGreaterThan(1.2);
  });
});

describe("cloudIndices", () => {
  const rings = 20;
  const sides = 8;
  const total = rings + 2 * CAP_RINGS;
  const cols = sides + 1;
  const all = cloudIndices(rings, sides, 1);
  it("takes one point per vertex, minus the seam column and the repeated tips", () => {
    expect(all).toHaveLength((total - 2) * sides + 2);
    expect(new Set(all).size).toBe(all.length);
    for (const i of all) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(total * cols);
      expect(i % cols).not.toBe(sides);
    }
  });
  it("keeps a single point at each tip", () => {
    const first = [...all].filter((i) => Math.floor(i / cols) === 0);
    const last = [...all].filter((i) => Math.floor(i / cols) === total - 1);
    expect(first).toHaveLength(1);
    expect(last).toHaveLength(1);
  });
  it("subsamples evenly with a stride, spread over the whole body", () => {
    const half = cloudIndices(rings, sides, 2);
    expect(half.length).toBeLessThan(all.length * 0.6);
    expect(half.length).toBeGreaterThan(all.length * 0.4);
    const ringsHit = new Set([...half].map((i) => Math.floor(i / cols)));
    expect(ringsHit.size).toBeGreaterThan(total - 4);
  });
  it("treats a stride below 1 as 1", () => {
    expect(cloudIndices(rings, sides, 0)).toHaveLength(all.length);
  });
});

describe("scene store", () => {
  beforeEach(() => sceneStore.reset());

  it("starts with the documented defaults", () => {
    expect(sceneStore.getState()).toEqual({
      chapter: 0,
      t: 0,
      pointer: null,
      theme: "dark",
      role: "fullstack",
      tier: "off",
      foods: [],
      avoid: [],
      drop: null,
      cta: null,
    });
  });
  it("merges partial state and notifies subscribers", () => {
    const fn = vi.fn();
    const off = sceneStore.subscribe(fn);
    sceneStore.setState({ chapter: 3, t: 0.4 });
    expect(sceneStore.getState()).toMatchObject({ chapter: 3, t: 0.4, tier: "off" });
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    sceneStore.setState({ chapter: 4 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("does not notify when nothing changed", () => {
    const fn = vi.fn();
    sceneStore.subscribe(fn);
    sceneStore.setState({ chapter: 0, t: 0 });
    sceneStore.setState({ pointer: null });
    expect(fn).not.toHaveBeenCalled();
  });
  it("accepts an updater function", () => {
    sceneStore.setState((s) => ({ chapter: s.chapter + 2 }));
    expect(sceneStore.getState().chapter).toBe(2);
  });
  it("returns a new snapshot object only after a change (useSyncExternalStore needs that)", () => {
    const a = sceneStore.getState();
    expect(sceneStore.getState()).toBe(a);
    sceneStore.setState({ chapter: 1 });
    expect(sceneStore.getState()).not.toBe(a);
  });
  it("createSceneStore gives independent stores", () => {
    const other = createSceneStore();
    other.setState({ chapter: 6 });
    expect(sceneStore.getState().chapter).toBe(0);
  });
});
