import { describe, expect, it } from "vitest";
import { FIG_PARAM } from "@/lib/case-list";
import {
  figureNumeral,
  jumpFigure,
  parseFigParam,
  stepFigure,
  type FigureNav,
} from "@/lib/figures/nav";

describe("parseFigParam", () => {
  it("reads the 1-based ?fig= as a 0-based index", () => {
    expect(FIG_PARAM).toBe("fig");
    expect(parseFigParam("?fig=2", 6)).toBe(1);
    expect(parseFigParam("?case=siteplus&fig=6", 6)).toBe(5);
  });

  it("opens figure 1 for an out-of-range or non-numeric value", () => {
    expect(parseFigParam("?fig=9", 6)).toBe(0);
    expect(parseFigParam("?fig=abc", 6)).toBe(0);
    expect(parseFigParam("?fig=0", 6)).toBe(0);
    expect(parseFigParam("?fig=-1", 6)).toBe(0);
    expect(parseFigParam("?fig=1.5", 6)).toBe(0);
    expect(parseFigParam("?fig=", 6)).toBe(0);
  });

  it("is null without figures or without the param", () => {
    expect(parseFigParam("?fig=2", 0)).toBeNull();
    expect(parseFigParam("?case=siteplus", 6)).toBeNull();
    expect(parseFigParam("", 6)).toBeNull();
  });
});

describe("stepFigure / jumpFigure", () => {
  const at = (index: number): FigureNav => ({ index, count: 6 });

  it("steps by one and clamps at both ends, no wrap", () => {
    expect(stepFigure(at(2), 1)).toEqual(at(3));
    expect(stepFigure(at(2), -1)).toEqual(at(1));
    expect(stepFigure(at(0), -1)).toEqual(at(0));
    expect(stepFigure(at(5), 1)).toEqual(at(5));
  });

  it("jumps to the first, the last or a clamped index", () => {
    expect(jumpFigure(at(3), "first")).toEqual(at(0));
    expect(jumpFigure(at(3), "last")).toEqual(at(5));
    expect(jumpFigure(at(3), 4)).toEqual(at(4));
    expect(jumpFigure(at(3), 99)).toEqual(at(5));
    expect(jumpFigure(at(3), -2)).toEqual(at(0));
  });
});

describe("figureNumeral", () => {
  it("writes a figure position in kanji numerals", () => {
    expect(
      [1, 2, 6, 9, 10, 11, 12, 20, 23].map((n) => figureNumeral(n)),
    ).toEqual(["一", "二", "六", "九", "十", "十一", "十二", "二十", "二十三"]);
  });
});
