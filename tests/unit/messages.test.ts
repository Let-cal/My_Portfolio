import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import vi from "@/messages/vi.json";

/** Message bundles nest objects and, for lists (chips, rotating words), string arrays. */
type Tree = { [key: string]: string | string[] | Tree };

/** Flattens nested messages into dotted leaf paths, e.g. `nav.hero` (array items become `.0`, `.1`, ...). */
function leaves(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [[path, value] as [string, string]] : leaves(value as Tree, path);
  });
}

const bundles = { en: en as Tree, ja: ja as Tree, vi: vi as Tree };
const enKeys = leaves(bundles.en).map(([k]) => k).sort();

describe("UI messages", () => {
  it("English bundle is not empty", () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  for (const [locale, tree] of Object.entries(bundles)) {
    it(`${locale} has exactly the same keys as en`, () => {
      expect(leaves(tree).map(([k]) => k).sort()).toEqual(enKeys);
    });

    it(`${locale} has no empty values`, () => {
      const empty = leaves(tree).filter(([, v]) => v.trim() === "").map(([k]) => k);
      expect(empty).toEqual([]);
    });
  }

  it("has a heading and nav label for every section", () => {
    const keys = new Set(enKeys);
    for (const id of ["hero", "experience", "projects", "skills", "certificates", "why", "contact"]) {
      expect(keys.has(`nav.${id}`), `nav.${id}`).toBe(true);
      expect(keys.has(`sections.${id}`), `sections.${id}`).toBe(true);
    }
  });
});
