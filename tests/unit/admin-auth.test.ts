import { describe, expect, it } from "vitest";
import { isAdminEmail, safeNextPath } from "@/lib/admin/auth";

describe("isAdminEmail", () => {
  it("ignores case and surrounding spaces", () => {
    expect(isAdminEmail(" A@x.com ", "a@x.com")).toBe(true);
  });
  it("rejects another address", () => {
    expect(isAdminEmail("b@x.com", "a@x.com")).toBe(false);
  });
  it("rejects when either side is missing", () => {
    expect(isAdminEmail("a@x.com", undefined)).toBe(false);
    expect(isAdminEmail(null, "a@x.com")).toBe(false);
    expect(isAdminEmail("", "")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps admin paths", () => {
    expect(safeNextPath("/admin/projects")).toBe("/admin/projects");
  });
  it("falls back to /admin for anything that could leave the admin area", () => {
    for (const bad of [
      null,
      "",
      "https://evil.test",
      "//evil.test",
      "/en",
      "/admin/../en",
      "/adminx",
    ]) {
      expect(safeNextPath(bad)).toBe("/admin");
    }
  });
});

describe("safeNextPath with a query", () => {
  it("keeps a query string on admin paths", () => {
    expect(safeNextPath("/admin/skills?filter=orphan")).toBe(
      "/admin/skills?filter=orphan",
    );
  });
  it("still rejects off-site paths that carry a query", () => {
    expect(safeNextPath("/en?x=/admin")).toBe("/admin");
    expect(safeNextPath("//evil.test/admin?x=1")).toBe("/admin");
  });
});
