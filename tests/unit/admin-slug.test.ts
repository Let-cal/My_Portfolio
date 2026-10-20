import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/admin/slug";

describe("slugify", () => {
  it("turns Vietnamese titles into kebab-case ids", () => {
    expect(slugify("Chứng chỉ AWS Đám mây (2026)")).toBe(
      "chung-chi-aws-dam-may-2026",
    );
    expect(slugify("IELTS 7.0")).toBe("ielts-7-0");
  });
  it("trims separators and caps the length", () => {
    expect(slugify("  --Hello__World--  ")).toBe("hello-world");
    expect(slugify("a".repeat(80)).length).toBe(48);
    expect(slugify("x ".repeat(40)).endsWith("-")).toBe(false);
  });
  it("returns an empty string when nothing is usable", () => {
    expect(slugify("日本語")).toBe("");
  });
});
