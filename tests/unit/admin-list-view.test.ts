import { describe, expect, it } from "vitest";
import { contentSchema } from "@/content/schema";
// Content as before the experience tree migration, until this test moves to the new model.
import seed from "../fixtures/seed-before-experience-tree.json";
import {
  copyId,
  filterRows,
  formatDate,
  formatPeriod,
  listRows,
  neighbours,
} from "@/lib/admin/list-view";

const c = contentSchema.parse(seed);

describe("formatting", () => {
  it("shows month periods the Vietnamese way", () => {
    expect(formatPeriod("2025-01", "2025-05")).toBe("01/2025 – 05/2025");
    expect(formatPeriod("2026-04", null)).toBe("04/2026 – nay");
  });
  it("shows dates day first", () => {
    expect(formatDate("2026-09-30")).toBe("30/09/2026");
  });
});

describe("listRows", () => {
  it("gives each experience a name, a period and its skill count", () => {
    const rows = listRows("experiences", c);
    const coa = rows.find((r) => r.id === "skg-coa")!;
    expect(coa.label).toBe("COA (Certificate of Analysis system)");
    expect(coa.detail).toContain(
      formatPeriod(
        c.experiences.find((e) => e.id === "skg-coa")!.start,
        c.experiences.find((e) => e.id === "skg-coa")!.end,
      ),
    );
    expect(coa.skillCount).toBe(
      c.skills.filter((s) => s.experienceIds.includes("skg-coa")).length,
    );
  });

  it("flags hidden items and missing translations", () => {
    const hidden = structuredClone(c);
    hidden.projects[0].published = false;
    hidden.projects[1].summary.ja = "";
    const rows = listRows("projects", hidden);
    expect(rows[0].hidden).toBe(true);
    expect(
      rows.find((r) => r.id === hidden.projects[1].id)!.missingLocales,
    ).toContain("ja");
  });
});

describe("filterRows", () => {
  const rows = listRows("experiences", c);

  it("finds by name without accents or case", () => {
    expect(
      filterRows(rows, { q: "flexybox", status: "all" }).map((r) => r.id),
    ).toEqual(expect.arrayContaining(["skg-flexybox-p1", "skg-flexybox-p2"]));
  });

  it("filters by status", () => {
    expect(filterRows(rows, { q: "", status: "no-skills" })).toHaveLength(0);
    expect(filterRows(rows, { q: "", status: "hidden" })).toHaveLength(0);
    expect(filterRows(rows, { q: "", status: "visible" })).toHaveLength(
      rows.length,
    );
  });
});

describe("neighbours", () => {
  it("gives the previous and next id in list order", () => {
    expect(neighbours(["a", "b", "c"], "b")).toEqual({ prev: "a", next: "c" });
    expect(neighbours(["a", "b", "c"], "a")).toEqual({ prev: null, next: "b" });
    expect(neighbours(["a", "b", "c"], "c")).toEqual({ prev: "b", next: null });
    expect(neighbours(["a"], "x")).toEqual({ prev: null, next: null });
  });
});

describe("copyId", () => {
  it("picks the first free -copy id", () => {
    expect(copyId("react", ["react"])).toBe("react-copy");
    expect(copyId("react", ["react", "react-copy", "react-copy-2"])).toBe(
      "react-copy-3",
    );
  });
});
