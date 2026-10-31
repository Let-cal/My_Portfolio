import { describe, expect, it } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import {
  archiveRows,
  groupByYear,
  yearSpan,
  type ArchiveRow,
} from "@/lib/archive";

const content = () => contentSchema.parse(structuredClone(seed));
const row = (id: string, year: string) => ({ id, year }) as ArchiveRow;

describe("groupByYear", () => {
  it("groupByYear newest first", () => {
    const groups = groupByYear([
      row("a", "2026"),
      row("b", "2026"),
      row("c", "2025"),
      row("d", "2026"),
      row("e", "2024"),
    ]);
    expect(groups.map((g) => g.year)).toEqual(["2026", "2025", "2024"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a", "b", "d"]);
  });

  it("sorts years even when rows arrive unordered", () => {
    expect(
      groupByYear([row("a", "2024"), row("b", "2026")]).map((g) => g.year),
    ).toEqual(["2026", "2024"]);
  });
});

describe("yearSpan", () => {
  it("spans the oldest to the newest start year", () => {
    expect(
      yearSpan([row("a", "2026"), row("b", "2023"), row("c", "2025")]),
    ).toBe("2023 – 2026");
  });

  it("shows a single year once", () => {
    expect(yearSpan([row("a", "2026"), row("b", "2026")])).toBe("2026");
  });

  it("is null without rows", () => {
    expect(yearSpan([])).toBeNull();
  });
});

describe("archiveRows stintLabel", () => {
  it("stintLabel for work rows", () => {
    const rows = archiveRows(content(), "en");
    const label = (id: string) => rows.find((r) => r.id === id)!.stintLabel;
    expect(label("skg-ai-agent")).toBe("Software Engineer");
    expect(label("skg-flexybox-p1")).toBe("Intern");
    expect(label("tongue-ai-driver-ms")).toBe("Intern");
  });

  it("is null for university and personal rows", () => {
    const rows = archiveRows(content(), "en");
    const others = rows.filter((r) => r.whereKind !== "work");
    expect(others.length).toBeGreaterThan(0);
    for (const r of others) expect(r.stintLabel).toBeNull();
  });

  it("uses the locale wording", () => {
    const rows = archiveRows(content(), "ja");
    expect(rows.find((r) => r.id === "skg-ai-agent")!.stintLabel).toBe(
      "ソフトウェアエンジニア",
    );
    expect(rows.find((r) => r.id === "skg-flexybox-p1")!.stintLabel).toBe(
      "インターン",
    );
  });
});
