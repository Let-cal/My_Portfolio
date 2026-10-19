import { describe, expect, it } from "vitest";
import { formatPeriod } from "@/lib/format";

describe("formatPeriod", () => {
  it("formats EN as 'Mon YYYY – Mon YYYY' with a spaced en dash", () => {
    expect(formatPeriod("2026-04", "2026-09", "en")).toBe(
      "Apr 2026 – Sep 2026",
    );
  });

  it("formats JA as 'YYYY年M月 – YYYY年M月'", () => {
    expect(formatPeriod("2026-04", "2026-09", "ja")).toBe(
      "2026年4月 – 2026年9月",
    );
  });

  it("formats VI as 'ThM YYYY – ThM YYYY'", () => {
    expect(formatPeriod("2026-04", "2026-09", "vi")).toBe(
      "Th4 2026 – Th9 2026",
    );
  });

  it("prints the localized 'present' word when end is null", () => {
    expect(formatPeriod("2026-04", null, "en")).toBe("Apr 2026 – Present");
    expect(formatPeriod("2026-04", null, "ja")).toBe("2026年4月 – 現在");
    expect(formatPeriod("2026-04", null, "vi")).toBe("Th4 2026 – Hiện tại");
  });

  it("collapses a single-month period to one date", () => {
    expect(formatPeriod("2024-03", "2024-03", "en")).toBe("Mar 2024");
    expect(formatPeriod("2024-03", "2024-03", "ja")).toBe("2024年3月");
  });
});
