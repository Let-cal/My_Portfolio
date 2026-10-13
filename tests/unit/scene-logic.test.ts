import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChapterProgress, transformState } from "@/scene/chapters";
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
  it("reports progress through the chapter", () => {
    expect(getChapterProgress(200, tops, 800)).toEqual({ chapter: 0, t: 0.25 });
    expect(getChapterProgress(1000, tops, 800)).toEqual({ chapter: 1, t: 0.25 });
  });
  it("clamps t to 0 when the chapter has just been entered ahead of its top", () => {
    expect(getChapterProgress(400, tops, 800)).toEqual({ chapter: 1, t: 0 });
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
