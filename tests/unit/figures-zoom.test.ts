import { describe, expect, it } from "vitest";
import {
  centerOn,
  clampView,
  containRect,
  fitScale,
  fitView,
  flipTransform,
  isZoomed,
  minimapRect,
  panBy,
  zoomAt,
  zoomTo,
} from "@/lib/figures/zoom";

const content = { w: 2000, h: 1000 };
const box = { w: 1000, h: 800 };
const fit = 0.5;

describe("fitScale", () => {
  it("is the largest scale that shows the whole figure", () => {
    expect(fitScale({ w: 2000, h: 1000 }, { w: 1000, h: 800 })).toBe(0.5);
    expect(fitScale({ w: 500, h: 1000 }, { w: 1000, h: 800 })).toBe(0.8);
  });

  it("is 1 while the box or the figure has no size yet", () => {
    expect(fitScale(content, { w: 0, h: 0 })).toBe(1);
    expect(fitScale({ w: 0, h: 0 }, box)).toBe(1);
  });
});

describe("fitView", () => {
  it("centres the fitted figure", () => {
    // 2000x1000 at 0.5 is 1000x500 inside 1000x800: 150 px above and below.
    expect(fitView(content, box)).toEqual({ scale: 0.5, x: 0, y: 150 });
  });
});

describe("clampView", () => {
  it("keeps the scale between fit and 400%", () => {
    expect(clampView({ scale: 0.1, x: 0, y: 0 }, content, box, fit).scale).toBe(
      0.5,
    );
    expect(clampView({ scale: 9, x: 0, y: 0 }, content, box, fit).scale).toBe(
      4,
    );
    expect(
      clampView({ scale: 2, x: -100, y: -100 }, content, box, fit),
    ).toEqual({ scale: 2, x: -100, y: -100 });
  });

  it("allows a fit above 400% for a tiny figure", () => {
    const tiny = { w: 100, h: 50 };
    const f = fitScale(tiny, box);
    expect(f).toBe(10);
    expect(clampView({ scale: 4, x: 0, y: 0 }, tiny, box, f).scale).toBe(10);
  });

  it("centres an axis smaller than the box and keeps a larger one covering it", () => {
    // At 0.6 the figure is 1200x600: wider than the box, shorter than it.
    const v = clampView({ scale: 0.6, x: 500, y: -999 }, content, box, fit);
    expect(v).toEqual({ scale: 0.6, x: 0, y: 100 });
    expect(clampView({ scale: 0.6, x: -5000, y: 0 }, content, box, fit).x).toBe(
      -200,
    );
  });
});

describe("zoomAt", () => {
  it("keeps the point under the pointer fixed", () => {
    const v = { scale: 1, x: -500, y: -100 };
    const point = { x: 300, y: 400 };
    // The figure point under the pointer before the zoom.
    const fx = (point.x - v.x) / v.scale;
    const fy = (point.y - v.y) / v.scale;
    const next = zoomAt(v, 1.2, point, content, box, fit);
    expect(next.scale).toBeCloseTo(1.2);
    expect(next.x + fx * next.scale).toBeCloseTo(point.x);
    expect(next.y + fy * next.scale).toBeCloseTo(point.y);
  });

  it("stops at fit and at 400%", () => {
    const at = { x: 500, y: 400 };
    expect(zoomAt(fitView(content, box), 0.5, at, content, box, fit)).toEqual(
      fitView(content, box),
    );
    expect(
      zoomAt({ scale: 3.9, x: -3000, y: -1000 }, 2, at, content, box, fit)
        .scale,
    ).toBe(4);
  });

  it("zoomTo sets an absolute scale around a point", () => {
    const v = zoomTo(
      fitView(content, box),
      1,
      { x: 500, y: 400 },
      content,
      box,
      fit,
    );
    expect(v.scale).toBe(1);
    // The centre of the figure stays at the centre of the box.
    expect(v.x + 1000).toBeCloseTo(500);
    expect(v.y + 500).toBeCloseTo(400);
  });
});

describe("panBy", () => {
  it("moves the figure and stops at the edges", () => {
    const v = { scale: 1, x: -500, y: -100 };
    expect(panBy(v, 100, 50, content, box, fit)).toEqual({
      scale: 1,
      x: -400,
      y: -50,
    });
    expect(panBy(v, 10_000, 10_000, content, box, fit)).toEqual({
      scale: 1,
      x: 0,
      y: 0,
    });
    expect(panBy(v, -10_000, -10_000, content, box, fit)).toEqual({
      scale: 1,
      x: -1000,
      y: -200,
    });
  });

  it("does nothing at fit", () => {
    const v = fitView(content, box);
    expect(panBy(v, 100, 100, content, box, fit)).toEqual(v);
  });
});

describe("centerOn", () => {
  it("puts a point of the figure (as fractions) at the centre of the box", () => {
    const v = centerOn({ scale: 1, x: 0, y: 0 }, 0.5, 0.5, content, box, fit);
    expect(v).toEqual({ scale: 1, x: -500, y: -100 });
    // Clamped at the edges.
    expect(centerOn({ scale: 1, x: 0, y: 0 }, 0, 0, content, box, fit)).toEqual(
      { scale: 1, x: 0, y: 0 },
    );
  });
});

describe("minimapRect", () => {
  it("is the whole figure at fit", () => {
    expect(minimapRect(fitView(content, box), content, box)).toEqual({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it("is the visible part of the figure when zoomed", () => {
    const r = minimapRect({ scale: 1, x: -500, y: -100 }, content, box);
    expect(r.x).toBeCloseTo(0.25);
    expect(r.y).toBeCloseTo(0.1);
    expect(r.w).toBeCloseTo(0.5);
    expect(r.h).toBeCloseTo(0.8);
  });
});

describe("isZoomed", () => {
  it("is true only beyond fit", () => {
    expect(isZoomed({ scale: 0.5, x: 0, y: 0 }, 0.5)).toBe(false);
    expect(isZoomed({ scale: 0.6, x: 0, y: 0 }, 0.5)).toBe(true);
  });
});

describe("containRect", () => {
  it("is the figure fitted and centred inside a rect", () => {
    expect(
      containRect({ w: 200, h: 100 }, { x: 10, y: 20, w: 400, h: 400 }),
    ).toEqual({ x: 10, y: 120, w: 400, h: 200 });
  });
});

describe("flipTransform", () => {
  it("maps one rect onto another around an origin", () => {
    const from = { x: 200, y: 100, w: 400, h: 200 };
    const to = { x: 50, y: 60, w: 100, h: 50 };
    const origin = { x: 100, y: 0 };
    const t = flipTransform(from, to, origin);
    expect(t.s).toBeCloseTo(0.25);
    // A point p maps to origin + s * (p - origin) + t.
    const map = (px: number, py: number) => ({
      x: origin.x + t.s * (px - origin.x) + t.x,
      y: origin.y + t.s * (py - origin.y) + t.y,
    });
    expect(map(from.x, from.y).x).toBeCloseTo(to.x);
    expect(map(from.x, from.y).y).toBeCloseTo(to.y);
    expect(map(from.x + from.w, from.y + from.h).x).toBeCloseTo(to.x + to.w);
    expect(map(from.x + from.w, from.y + from.h).y).toBeCloseTo(to.y + to.h);
  });
});
