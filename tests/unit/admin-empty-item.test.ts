import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyItem } from "@/lib/admin/empty-item";
import { RESOURCE_KEYS, resources } from "@/lib/admin/resources";

describe("emptyItem", () => {
  it.each(RESOURCE_KEYS)("gives a starting value for every %s field", (key) => {
    const item = emptyItem(key);
    expect(Object.keys(item).sort()).toEqual(
      resources[key].fields.map((f) => f.name).sort(),
    );
  });

  it("starts lists empty and translations blank", () => {
    const project = emptyItem("projects");
    expect(project.skillIds).toEqual([]);
    expect(project.tech).toEqual([]);
    expect(project.summary).toEqual({ en: "", ja: "", vi: "" });
    expect(project.published).toBe(true);
    expect(emptyItem("education").notes).toBeNull();
  });

  it("can be called from server code (no 'use client' module)", () => {
    const source = readFileSync("src/lib/admin/empty-item.ts", "utf8");
    expect(source).not.toMatch(/["']use client["']/);
  });
});
