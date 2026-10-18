import { describe, expect, it } from "vitest";
import { localizedPath } from "@/lib/localized-path";

describe("the portfolio's always-prefixed locale paths", () => {
  it.each([
    ["/en", "ja", "/ja"],
    ["/vi/quick", "en", "/en/quick"],
    ["/ja/quick", "vi", "/vi/quick"],
    ["/", "ja", "/ja"],
    ["/english", "vi", "/vi/english"],
  ] as const)("maps %s to %s", (path, locale, expected) => {
    expect(localizedPath(path, locale)).toBe(expected);
  });
});
