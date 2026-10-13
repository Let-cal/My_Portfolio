import { describe, expect, it } from "vitest";
import { ROLE_ACCENT, SECTOR_FROM, angleFromPoint, sectorForAngle } from "@/lib/role-accent";

describe("ROLE_ACCENT", () => {
  it("uses the approved prototype colours", () => {
    expect(ROLE_ACCENT.fullstack).toBe("#0ea5e9");
    expect(ROLE_ACCENT.techlead).toBe("#38bdf8");
    expect(ROLE_ACCENT.pm).toBe("#e0a84e");
  });
});

describe("SECTOR_FROM", () => {
  it("starts each 120° slice at its CSS angle (0° = top, clockwise)", () => {
    expect(SECTOR_FROM).toEqual({ fullstack: 240, techlead: 0, pm: 120 });
  });
});

describe("sectorForAngle", () => {
  it("splits the circle into upper-left, upper-right and bottom slices", () => {
    expect(sectorForAngle(300)).toBe("fullstack");
    expect(sectorForAngle(30)).toBe("techlead");
    expect(sectorForAngle(180)).toBe("pm");
  });

  it("normalises angles outside [0, 360)", () => {
    expect(sectorForAngle(-60)).toBe("fullstack");
    expect(sectorForAngle(360)).toBe("techlead");
    expect(sectorForAngle(720 + 130)).toBe("pm");
  });

  it("puts each boundary in the slice that starts there", () => {
    expect(sectorForAngle(0)).toBe("techlead");
    expect(sectorForAngle(120)).toBe("pm");
    expect(sectorForAngle(240)).toBe("fullstack");
    expect(sectorForAngle(359.9)).toBe("fullstack");
  });
});

describe("angleFromPoint", () => {
  it("returns the CSS angle of a point around a centre", () => {
    expect(angleFromPoint(0, -10, 0, 0)).toBeCloseTo(0);
    expect(angleFromPoint(10, 0, 0, 0)).toBeCloseTo(90);
    expect(angleFromPoint(0, 10, 0, 0)).toBeCloseTo(180);
    expect(angleFromPoint(-10, 0, 0, 0)).toBeCloseTo(270);
  });

  it("is always in [0, 360) and works with an offset centre", () => {
    const a = angleFromPoint(90, 110, 100, 100);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(360);
    expect(a).toBeCloseTo(225);
  });
});
