import { describe, expect, it } from "vitest";
import {
  buildThreadPath,
  chapterProgress,
  threadPosition,
} from "@/components/site/ink-thread";

/** Every point of the path, in order: the move-to, then each cubic's two control points and its end point. */
function points(d: string) {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

const rect = (top: number, height: number) =>
  ({ top, height }) as DOMRectReadOnly;

describe("buildThreadPath", () => {
  it("passes through every y", () => {
    const ys = [12, 50, 96.5, 140];
    const d = buildThreadPath(ys, 10, 2.5);
    expect(d.startsWith("M")).toBe(true);
    expect((d.match(/C/g) ?? []).length).toBe(ys.length - 1);
    const pts = points(d);
    // M + three points per cubic.
    expect(pts).toHaveLength(1 + 3 * (ys.length - 1));
    const anchors = [pts[0], ...pts.filter((_, i) => i > 0 && i % 3 === 0)];
    expect(anchors).toEqual(ys.map((y) => [10, y]));
  });

  it("sways a little to alternate sides between items", () => {
    const pts = points(buildThreadPath([0, 40, 80], 10, 2.5));
    // First cubic: controls at x + sway then x - sway; second cubic mirrors it.
    expect([pts[1][0], pts[2][0], pts[4][0], pts[5][0]]).toEqual([
      12.5, 7.5, 7.5, 12.5,
    ]);
  });

  it("is a single point for one item and empty for none", () => {
    expect(buildThreadPath([20], 10, 2.5)).toBe("M10 20");
    expect(buildThreadPath([], 10, 2.5)).toBe("");
  });
});

describe("threadPosition", () => {
  const ys = [0, 100, 200];

  it("interpolates inside the active chapter", () => {
    expect(threadPosition(ys, 0, 0)).toBe(0);
    expect(threadPosition(ys, 1, 0.5)).toBe(150);
    expect(threadPosition(ys, 0, 0.25)).toBe(25);
  });

  it("stops at the last item and clamps progress and index", () => {
    expect(threadPosition(ys, 2, 0.7)).toBe(200);
    expect(threadPosition(ys, 0, 1.5)).toBe(100);
    expect(threadPosition(ys, 1, -1)).toBe(100);
    expect(threadPosition(ys, 9, 0.5)).toBe(200);
    expect(threadPosition(ys, -3, 0.5)).toBe(50);
    expect(threadPosition([], 0, 0.5)).toBe(0);
  });
});

describe("chapterProgress", () => {
  it("is the share of the chapter above the reading line", () => {
    expect(chapterProgress(rect(100, 400), 300)).toBe(0.5);
  });

  it("clamps", () => {
    expect(chapterProgress(rect(100, 400), 50)).toBe(0);
    expect(chapterProgress(rect(100, 400), 900)).toBe(1);
    expect(chapterProgress(rect(-2000, 400), 450)).toBe(1);
    // A chapter with no height is either read or not.
    expect(chapterProgress(rect(100, 0), 200)).toBe(1);
    expect(chapterProgress(rect(100, 0), 50)).toBe(0);
  });
});
