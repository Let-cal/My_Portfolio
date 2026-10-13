import { describe, expect, it } from "vitest";
import { pickLocale } from "@/lib/i18n-text";

describe("pickLocale", () => {
  it("falls back to en when the requested locale is empty", () => {
    expect(pickLocale({ en: "Hi", ja: "" }, "ja")).toBe("Hi");
  });
  it("falls back to en when the requested locale is missing", () => {
    expect(pickLocale({ en: "Hi" }, "vi")).toBe("Hi");
  });
  it("returns the requested translation when present", () => {
    expect(pickLocale({ en: "Hi", vi: "Chào" }, "vi")).toBe("Chào");
    expect(pickLocale({ en: "Hi", ja: "こんにちは" }, "en")).toBe("Hi");
  });
  it("returns an empty string when there is no text", () => {
    expect(pickLocale(undefined, "en")).toBe("");
    expect(pickLocale(null, "ja")).toBe("");
  });
});
