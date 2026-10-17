import { describe, expect, it } from "vitest";
import { beamPath, type Box } from "@/components/sections/skills/beam-geometry";

const box = (left: number, top: number, w: number, h: number): Box => ({ left, top, right: left + w, bottom: top + h });
const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe("beamPath", () => {
  it("runs sideways from the chip's right edge to a card on its right", () => {
    const d = beamPath(box(20, 40, 90, 32), box(600, 100, 240, 60), { left: 0, top: 0 });
    // start (110, 56) -> end (600, 130)
    expect(numbers(d)).toEqual([110, 56, 355, 56, 355, 130, 600, 130]);
  });

  it("leaves from the chip's bottom and enters the card's left edge when the card is below", () => {
    const d = beamPath(box(40, 100, 80, 30), box(34, 500, 320, 70), { left: 0, top: 0 });
    const n = numbers(d);
    expect([n[0], n[1]]).toEqual([80, 130]);
    expect([n[6], n[7]]).toEqual([34, 535]);
  });

  it("leaves from the chip's top when the card is above", () => {
    const d = beamPath(box(40, 400, 80, 30), box(34, 100, 320, 70), { left: 0, top: 0 });
    expect(numbers(d).slice(0, 2)).toEqual([80, 400]);
  });

  it("is relative to the origin", () => {
    const a = numbers(beamPath(box(120, 140, 90, 32), box(700, 200, 240, 60), { left: 100, top: 100 }));
    const b = numbers(beamPath(box(20, 40, 90, 32), box(600, 100, 240, 60), { left: 0, top: 0 }));
    expect(a).toEqual(b);
  });
});
