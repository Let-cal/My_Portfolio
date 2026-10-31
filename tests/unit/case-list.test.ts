import { describe, expect, it } from "vitest";
import {
  CASE_PARAM,
  caseIds,
  neighbours,
  parseCaseParam,
} from "@/lib/case-list";

describe("caseIds", () => {
  it("caseIds skips projects without a case study", () => {
    expect(
      caseIds([
        { id: "a", caseStudy: {} },
        { id: "b", caseStudy: null },
        { id: "c", caseStudy: { x: 1 } },
      ]),
    ).toEqual(["a", "c"]);
  });
});

describe("neighbours", () => {
  const ids = ["a", "b", "c"];

  it("neighbours wraps around", () => {
    expect(neighbours(ids, "a")).toEqual({
      prev: "c",
      next: "b",
      index: 0,
      total: 3,
    });
    expect(neighbours(ids, "c")).toEqual({
      prev: "b",
      next: "a",
      index: 2,
      total: 3,
    });
  });

  it("a single project has no neighbours", () => {
    expect(neighbours(["a"], "a")).toEqual({
      prev: null,
      next: null,
      index: 0,
      total: 1,
    });
  });

  it("an id outside the list has no position", () => {
    expect(neighbours(ids, "zzz")).toEqual({
      prev: null,
      next: null,
      index: -1,
      total: 3,
    });
  });
});

describe("parseCaseParam", () => {
  const known = new Set(["a", "b"]);

  it("parseCaseParam reads ?case=", () => {
    expect(CASE_PARAM).toBe("case");
    expect(parseCaseParam("?case=b", known)).toBe("b");
    expect(parseCaseParam("kind=work&case=a", known)).toBe("a");
  });

  it("parseCaseParam ignores unknown ids", () => {
    expect(parseCaseParam("?case=zzz", known)).toBeNull();
    expect(parseCaseParam("?kind=work", known)).toBeNull();
    expect(parseCaseParam("", known)).toBeNull();
  });
});
