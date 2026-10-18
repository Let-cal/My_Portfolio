import { describe, expect, it } from "vitest";
import { aspectPullback, cameraAt, chapterPosition, CHAPTER_CAMERA, type CameraPose } from "@/scene/chapters";
import { creatureVisibility, findOpenSpot, LARGE_DAY_SHARE, MAX_AVOID, mergeRects, rectCoverage, rectsNear, selectRects, veilOpacity, type Rect } from "@/scene/environment/legibility";
import { dampValue, propWeight, stepDay } from "@/scene/environment/math";
import { addRipple, createRipples, MAX_RIPPLES, RIPPLE_IDLE } from "@/scene/environment/ripples";

type V = { x: number; y: number; z: number };
const pose = (): { pos: V; look: V } => ({ pos: { x: 0, y: 0, z: 0 }, look: { x: 0, y: 0, z: 0 } });
const arr = (v: V) => [v.x, v.y, v.z];
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe("CHAPTER_CAMERA", () => {
  it("has one pose per chapter and chapter 0 looks down on the pond from above and in front", () => {
    expect(CHAPTER_CAMERA).toHaveLength(7);
    const hero: CameraPose = CHAPTER_CAMERA[0];
    expect(hero.pos[1]).toBeGreaterThan(2.5);
    expect(hero.pos[1]).toBeGreaterThan(hero.look[1] + 2);
    // The camera sits at +z, so the view runs down and into the pond.
    expect(hero.pos[2]).toBeGreaterThan(hero.look[2]);
  });
});

describe("chapterPosition and cameraAt", () => {
  it("holds a chapter's camera for the first half of the chapter, then eases to the next one", () => {
    expect(chapterPosition(2, 0)).toBe(2);
    expect(chapterPosition(2, 0.5)).toBe(2);
    const a = chapterPosition(2, 0.7);
    const b = chapterPosition(2, 0.9);
    expect(a).toBeGreaterThan(2);
    expect(b).toBeGreaterThan(a);
    expect(chapterPosition(2, 1)).toBe(3);
  });

  it("has no next chapter after the last one", () => {
    expect(chapterPosition(6, 0)).toBe(6);
    expect(chapterPosition(6, 1)).toBe(6);
  });

  it("returns the table entry at the start of a chapter", () => {
    const out = pose();
    for (let c = 0; c < 7; c++) {
      cameraAt(c, 0, out);
      expect(arr(out.pos)).toEqual(CHAPTER_CAMERA[c].pos);
      expect(arr(out.look)).toEqual(CHAPTER_CAMERA[c].look);
    }
  });

  it("interpolates towards the next chapter and arrives exactly at the end", () => {
    const out = pose();
    cameraAt(0, 0.8, out);
    const from = CHAPTER_CAMERA[0].pos;
    const to = CHAPTER_CAMERA[1].pos;
    expect(dist(arr(out.pos), from)).toBeGreaterThan(0);
    expect(dist(arr(out.pos), from)).toBeLessThan(dist(to, from));
    cameraAt(0, 1, out);
    expect(arr(out.pos)).toEqual(to);
    expect(arr(out.look)).toEqual(CHAPTER_CAMERA[1].look);
  });

  it("moves continuously and monotonically through a chapter", () => {
    const out = pose();
    let last = 0;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      cameraAt(3, t, out);
      const d = dist(arr(out.pos), CHAPTER_CAMERA[3].pos);
      expect(d).toBeGreaterThanOrEqual(last - 1e-9);
      last = d;
    }
  });

  it("clamps chapters outside 0 to 6", () => {
    const out = pose();
    cameraAt(-3, 0.5, out);
    expect(arr(out.pos)).toEqual(CHAPTER_CAMERA[0].pos);
    cameraAt(99, 0.5, out);
    expect(arr(out.pos)).toEqual(CHAPTER_CAMERA[6].pos);
  });
});

describe("aspectPullback", () => {
  it("leaves landscape screens alone", () => {
    expect(aspectPullback(1.6)).toBe(1);
    expect(aspectPullback(2.4)).toBe(1);
  });

  it("pulls the camera back on portrait screens, more the narrower they are, but not without limit", () => {
    const tablet = aspectPullback(0.75);
    const phone = aspectPullback(390 / 844);
    expect(tablet).toBeGreaterThan(1);
    expect(phone).toBeGreaterThan(tablet);
    expect(aspectPullback(0.05)).toBeLessThanOrEqual(2.2);
  });
});

describe("rectCoverage", () => {
  const box: Rect = { x0: 100, y0: 100, x1: 300, y1: 200 };

  it("is 1 inside a rectangle and 0 further than the feather outside it", () => {
    expect(rectCoverage([box], 200, 150, 40)).toBe(1);
    expect(rectCoverage([box], 100, 100, 40)).toBe(1);
    expect(rectCoverage([box], 340, 150, 40)).toBe(0);
    expect(rectCoverage([box], 200, 260, 40)).toBe(0);
  });

  it("falls off smoothly across the feather", () => {
    const near = rectCoverage([box], 310, 150, 40);
    const far = rectCoverage([box], 330, 150, 40);
    expect(near).toBeGreaterThan(far);
    expect(near).toBeLessThan(1);
    expect(far).toBeGreaterThan(0);
  });

  it("takes the strongest of several rectangles and is 0 with none", () => {
    const other: Rect = { x0: 500, y0: 100, x1: 600, y1: 200 };
    expect(rectCoverage([box, other], 550, 150, 40)).toBe(1);
    expect(rectCoverage([], 550, 150, 40)).toBe(0);
  });
});

describe("creatureVisibility", () => {
  const box: Rect = { x0: 0, y0: 0, x1: 400, y1: 400 };

  it("is 1 when no part of the creature is under text", () => {
    expect(creatureVisibility([box], [{ x: 900, y: 900 }], 40, 0.3)).toBe(1);
    expect(creatureVisibility([], [{ x: 10, y: 10 }], 40, 0.3)).toBe(1);
  });

  it("falls to the floor when the whole creature is under text, and in between for part of it", () => {
    const under = [{ x: 100, y: 100 }, { x: 200, y: 200 }];
    const half = [{ x: 100, y: 100 }, { x: 900, y: 900 }];
    expect(creatureVisibility([box], under, 40, 0.3)).toBeCloseTo(0.3, 10);
    const part = creatureVisibility([box], half, 40, 0.3);
    expect(part).toBeGreaterThan(0.3);
    expect(part).toBeLessThan(1);
  });
});

describe("selectRects", () => {
  const vw = 1000;
  const vh = 800;

  it("drops rectangles that are off screen and keeps the biggest MAX_AVOID", () => {
    const rects: Rect[] = [
      { x0: 0, y0: -500, x1: 100, y1: -400 },
      { x0: 0, y0: 900, x1: 100, y1: 1000 },
    ];
    for (let i = 0; i < 30; i++) rects.push({ x0: 10, y0: 10 + i, x1: 10 + 10 * (i + 1), y1: 40 + i });
    const picked = selectRects(rects, vw, vh);
    expect(picked).toHaveLength(MAX_AVOID);
    expect(picked.every((r) => r.y1 > 0 && r.y0 < vh)).toBe(true);
    // The widest ones survive.
    expect(Math.max(...picked.map((r) => r.x1))).toBe(310);
    expect(Math.min(...picked.map((r) => r.x1 - r.x0))).toBeGreaterThanOrEqual(70);
  });

  it("clips what it keeps to the viewport and ignores empty rectangles", () => {
    const picked = selectRects(
      [
        { x0: -50, y0: 10, x1: 2000, y1: 60 },
        { x0: 5, y0: 5, x1: 5, y1: 50 },
      ],
      vw,
      vh,
    );
    expect(picked).toEqual([{ x0: 0, y0: 10, x1: vw, y1: 60 }]);
  });
});

describe("rectsNear", () => {
  const a: Rect = { x0: 0, y0: 0, x1: 100, y1: 100 };
  it("is true when the rectangles overlap or are within the margin of each other", () => {
    expect(rectsNear(a, { x0: 50, y0: 50, x1: 200, y1: 200 }, 0)).toBe(true);
    expect(rectsNear(a, { x0: 130, y0: 0, x1: 200, y1: 100 }, 40)).toBe(true);
    expect(rectsNear(a, { x0: 130, y0: 0, x1: 200, y1: 100 }, 20)).toBe(false);
    expect(rectsNear(a, { x0: 0, y0: -200, x1: 100, y1: -150 }, 40)).toBe(false);
  });
});

describe("veilOpacity", () => {
  const rect: Rect = { x0: 100, y0: 100, x1: 300, y1: 200 };
  const far: Rect = { x0: 900, y0: 600, x1: 1000, y1: 700 };
  const near: Rect = { x0: 250, y0: 150, x1: 400, y1: 250 };
  const base = { day: 0, props: 0, floor: 0.3, margin: 100 };

  it("is the floor on a dark empty pond: nothing bright is behind the text", () => {
    expect(veilOpacity(rect, far, base)).toBe(0.3);
    expect(veilOpacity(rect, null, base)).toBe(0.3);
  });

  it("is full while the creature is under or near the text", () => {
    expect(veilOpacity(rect, near, base)).toBe(1);
    expect(veilOpacity(rect, { x0: 350, y0: 100, x1: 380, y1: 150 }, base)).toBe(1);
  });

  it("is full where scenery is on screen, and by day when the whole pond is bright; fades in between", () => {
    expect(veilOpacity(rect, far, { ...base, props: 1 })).toBe(1);
    expect(veilOpacity(rect, far, { ...base, day: 1 })).toBe(1);
    const half = veilOpacity(rect, far, { ...base, day: 0.5 });
    expect(half).toBeGreaterThan(0.3);
    expect(half).toBeLessThan(1);
  });
});

describe("veilOpacity for large text", () => {
  const big: Rect = { x0: 100, y0: 100, x1: 300, y1: 200, large: true };
  const near: Rect = { x0: 250, y0: 150, x1: 400, y1: 250 };
  const opts = { day: 0, props: 0, floor: 0.3, margin: 100 };

  it("by day keeps most of the veil (a muted large title still needs a calm backdrop), and all of it next to the creature", () => {
    const calm = veilOpacity(big, null, { ...opts, day: 1 });
    expect(calm).toBeCloseTo(0.3 + 0.7 * LARGE_DAY_SHARE, 10);
    expect(calm).toBeGreaterThanOrEqual(0.6);
    expect(calm).toBeLessThan(1);
    expect(veilOpacity(big, near, { ...opts, day: 1 })).toBe(1);
    // Small text gets the full veil by day.
    expect(veilOpacity({ ...big, large: false }, null, { ...opts, day: 1 })).toBe(1);
  });

  it("at night is treated like any other text, and scenery calls for a veil by day too", () => {
    expect(veilOpacity(big, near, opts)).toBe(1);
    expect(veilOpacity(big, null, opts)).toBe(0.3);
    expect(veilOpacity(big, null, { ...opts, day: 1, props: 1 })).toBe(1);
  });

  it("a merged block is large only if every part is", () => {
    const merged = mergeRects(
      [
        { x0: 0, y0: 0, x1: 100, y1: 30, large: true },
        { x0: 0, y0: 40, x1: 100, y1: 70, large: false },
      ],
      20,
    );
    expect(merged[0].large).toBe(false);
    expect(mergeRects([{ x0: 0, y0: 0, x1: 100, y1: 30, large: true }, { x0: 0, y0: 40, x1: 100, y1: 70, large: true }], 20)[0].large).toBe(true);
  });
});

describe("mergeRects", () => {
  it("does not fill an empty courtyard between a sidebar and an offset content card", () => {
    const blocks = [{ x0: 20, y0: 200, x1: 360, y1: 500 }, { x0: 350, y0: 490, x1: 1000, y1: 700 }];
    expect(mergeRects(blocks, 28)).toHaveLength(2);
  });
  it("joins rectangles that touch or sit closer than the gap, so a row of chips becomes one block", () => {
    const chips: Rect[] = [0, 1, 2, 3].map((i) => ({ x0: i * 60, y0: 0, x1: i * 60 + 50, y1: 24 }));
    const merged = mergeRects(chips, 20);
    expect(merged).toEqual([{ x0: 0, y0: 0, x1: 230, y1: 24 }]);
  });

  it("keeps rectangles that are farther apart than the gap, and chains through a middle one", () => {
    const far: Rect[] = [
      { x0: 0, y0: 0, x1: 100, y1: 20 },
      { x0: 0, y0: 200, x1: 100, y1: 220 },
    ];
    expect(mergeRects(far, 20)).toHaveLength(2);
    const chain: Rect[] = [
      { x0: 0, y0: 0, x1: 100, y1: 20 },
      { x0: 0, y0: 30, x1: 100, y1: 50 },
      { x0: 0, y0: 60, x1: 100, y1: 80 },
    ];
    expect(mergeRects(chain, 15)).toEqual([{ x0: 0, y0: 0, x1: 100, y1: 80 }]);
  });

  it("does not change its input", () => {
    const a: Rect[] = [{ x0: 0, y0: 0, x1: 10, y1: 10 }, { x0: 12, y0: 0, x1: 20, y1: 10 }];
    mergeRects(a, 5);
    expect(a[1]).toEqual({ x0: 12, y0: 0, x1: 20, y1: 10 });
  });
});

describe("ripples", () => {
  it("starts with 12 idle slots", () => {
    const r = createRipples();
    expect(MAX_RIPPLES).toBe(12);
    expect(r.data).toHaveLength(36);
    for (let i = 0; i < MAX_RIPPLES; i++) expect(r.data[i * 3 + 2]).toBe(RIPPLE_IDLE);
  });

  it("writes {x, z, t0} and reuses the oldest slot once all twelve are used", () => {
    const r = createRipples();
    for (let i = 0; i < 13; i++) addRipple(r, i, -i, i * 0.1);
    // Slot 0 was overwritten by the 13th ripple; slot 1 still holds the second one.
    expect(r.data[0]).toBe(12);
    expect(r.data[1]).toBe(-12);
    expect(r.data[2]).toBeCloseTo(1.2, 5);
    expect(r.data[3]).toBe(1);
    expect(r.data[4]).toBe(-1);
    expect(r.data[5]).toBeCloseTo(0.1, 5);
  });
});

describe("day/night blend", () => {
  it("moves 0 to 1 in about 600 ms and back, and stops at the target", () => {
    let d = 0;
    for (let i = 0; i < 10; i++) d = stepDay(d, 1, 0.06);
    expect(d).toBeCloseTo(1, 5);
    expect(stepDay(0.5, 0.5, 0.1)).toBe(0.5);
    expect(stepDay(1, 0, 0.3)).toBeCloseTo(0.5, 5);
    expect(stepDay(0.1, 0, 5)).toBe(0);
  });

  it("dampValue approaches the target without overshooting and is frame-rate independent", () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = dampValue(a, 10, 3, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = dampValue(b, 10, 3, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
    expect(a).toBeLessThan(10);
    expect(a).toBeGreaterThan(9);
  });
});

describe("propWeight", () => {
  it("is 1 on the chapter, fades out over the neighbouring chapter and is 0 beyond it", () => {
    expect(propWeight(2, 2)).toBe(1);
    expect(propWeight(2.2, 2)).toBe(1);
    expect(propWeight(2.7, 2)).toBeGreaterThan(0);
    expect(propWeight(2.7, 2)).toBeLessThan(1);
    expect(propWeight(2.95, 2)).toBeLessThan(0.05);
    expect(propWeight(3, 2)).toBe(0);
    expect(propWeight(0, 2)).toBe(0);
  });

  it("is symmetric and never leaves 0..1", () => {
    for (let p = -1; p <= 8; p += 0.1) {
      const w = propWeight(p, 4);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
    }
    expect(propWeight(3.4, 4)).toBeCloseTo(propWeight(4.6, 4), 10);
  });
});

describe("findOpenSpot", () => {
  const W = 1200;
  const H = 800;
  const rect = (x0: number, y0: number, x1: number, y1: number): Rect => ({ x0, y0, x1, y1 });

  it("picks somewhere near the middle of an empty screen, inside it", () => {
    const p = findOpenSpot([], W, H);
    expect(p.x).toBeGreaterThan(W * 0.1);
    expect(p.x).toBeLessThan(W * 0.9);
    expect(p.y).toBeGreaterThan(H * 0.1);
    expect(p.y).toBeLessThan(H * 0.9);
  });

  it("goes to the open water: with the right two thirds covered it stays on the left", () => {
    const p = findOpenSpot([rect(500, 0, W, H)], W, H);
    expect(p.x).toBeLessThan(400);
  });

  it("finds a gap between two blocks of text, in the open band", () => {
    const p = findOpenSpot([rect(0, 0, W, 250), rect(0, 560, W, H)], W, H);
    expect(p.y).toBeGreaterThan(300);
    expect(p.y).toBeLessThan(520);
  });

  it("prefers a roomy spot to a gap next to text", () => {
    // A thin free strip beside the cards against a wide free area below them.
    const cards = [rect(300, 0, W, 500)];
    const p = findOpenSpot(cards, W, H);
    expect(p.y).toBeGreaterThan(500);
  });

  it("still answers when everything is covered, with the least covered place", () => {
    const p = findOpenSpot([rect(0, 0, W, H), rect(0, 0, 100, 100)], W, H);
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });

  it("keeps the previous spot while it is almost as good, so it does not flutter between two", () => {
    const first = findOpenSpot([rect(500, 0, W, H)], W, H);
    // A rectangle that barely moves does not move the spot.
    const again = findOpenSpot([rect(520, 0, W, H)], W, H, first);
    expect(again).toBe(first);
    // A block that lands on it does.
    const moved = findOpenSpot([rect(0, 0, 450, H)], W, H, first);
    expect(moved).not.toBe(first);
    expect(moved.x).toBeGreaterThan(450);
  });

  it("keeps clear of a block at the bottom left, such as the social icons of the side rail", () => {
    // Everything is free except a small block in the corner and a card column on the right.
    const icons = rect(30, 700, 180, 760);
    const p = findOpenSpot([icons, rect(700, 0, W, H)], W, H);
    const clear = Math.hypot(Math.max(icons.x0 - p.x, 0, p.x - icons.x1), Math.max(icons.y0 - p.y, 0, p.y - icons.y1));
    expect(clear).toBeGreaterThan(120);
    // And with the whole left column covered except that corner's neighbourhood, it still does not pick the corner.
    const q = findOpenSpot([icons, rect(0, 0, 400, 690), rect(700, 0, W, H)], W, H);
    expect(Math.hypot(Math.max(icons.x0 - q.x, 0, q.x - icons.x1), Math.max(icons.y0 - q.y, 0, q.y - icons.y1))).toBeGreaterThan(60);
  });

  it("writes into the object it is given", () => {
    const out = { x: 0, y: 0 };
    expect(findOpenSpot([rect(500, 0, W, H)], W, H, null, out)).toBe(out);
    expect(out.x).toBeLessThan(400);
  });
});
