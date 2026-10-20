import { describe, expect, it } from "vitest";
import { mergeRows, signature } from "@/lib/admin/sync";

describe("signature", () => {
  it("ignores key order", () => {
    expect(signature({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe(
      signature({ a: [1, { c: 3, d: 2 }], b: 1 }),
    );
  });
  it("changes when a value changes", () => {
    expect(signature({ a: 1 })).not.toBe(signature({ a: 2 }));
  });
});

describe("mergeRows", () => {
  const server = [
    { id: "a", hidden: false },
    { id: "b", hidden: false },
  ];
  it("applies pending changes over server rows", () => {
    expect(mergeRows(server, new Map([["a", { hidden: true }]]))).toEqual([
      { id: "a", hidden: true },
      { id: "b", hidden: false },
    ]);
  });
  it("drops rows pending deletion", () => {
    expect(mergeRows(server, new Map([["b", "deleted" as const]]))).toEqual([
      { id: "a", hidden: false },
    ]);
  });
});
