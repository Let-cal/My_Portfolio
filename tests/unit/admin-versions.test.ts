import { describe, expect, it } from "vitest";
import { diffRow } from "@/lib/admin/versions";

describe("diffRow", () => {
  it("lists one line per changed leaf, i18n by language", () => {
    expect(
      diffRow(
        {
          summary: { en: "A", ja: "", vi: "C" },
          tech: ["a"],
          sort_index: 1,
          updated_at: "x",
        },
        {
          summary: { en: "A", ja: "B", vi: "C" },
          tech: ["a", "b"],
          sort_index: 9,
          updated_at: "y",
        },
      ),
    ).toEqual([
      { field: "summary.ja", before: "—", after: "B" },
      { field: "tech", before: "a", after: "a, b" },
    ]);
  });

  it("reads nested objects and booleans", () => {
    expect(
      diffRow(
        { summaries: { pm: { en: "old" } }, published: true },
        { summaries: { pm: { en: "new" } }, published: false },
      ),
    ).toEqual([
      { field: "summaries.pm.en", before: "old", after: "new" },
      { field: "published", before: "Có", after: "Không" },
    ]);
  });

  it("shows the whole old row when the item is gone", () => {
    expect(diffRow({ id: "x", name: "N" }, null)).toContainEqual({
      field: "name",
      before: "N",
      after: "—",
    });
  });

  it("returns nothing when nothing changed", () => {
    expect(
      diffRow({ name: "N", created_at: "a" }, { name: "N", created_at: "b" }),
    ).toEqual([]);
  });
});
