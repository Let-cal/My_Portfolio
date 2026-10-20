import { describe, expect, it } from "vitest";
import { diffLinks } from "@/lib/admin/links";

describe("diffLinks", () => {
  it("adds what is new and removes what is gone", () => {
    expect(diffLinks(["a", "b"], ["b", "c"])).toEqual({
      add: ["c"],
      remove: ["a"],
    });
  });
  it("ignores duplicates and order", () => {
    expect(diffLinks(["b", "a"], ["a", "a", "b"])).toEqual({
      add: [],
      remove: [],
    });
    expect(diffLinks([], ["x", "x"])).toEqual({ add: ["x"], remove: [] });
  });
});
