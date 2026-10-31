import { describe, expect, it, vi } from "vitest";
import {
  formatDuration,
  formatPeriod,
  kanjiYear,
  monthsBetween,
} from "@/lib/format";

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

describe("formatDuration", () => {
  it("counts inclusive months", () => {
    expect(monthsBetween("2025-08", "2026-09")).toBe(14);
    expect(formatDuration("2025-08", "2026-09", "en")).toBe("1 yr 2 mos");
    expect(formatDuration("2025-08", "2026-09", "vi")).toBe("1 năm 2 tháng");
    expect(formatDuration("2025-08", "2026-09", "ja")).toBe("1年2か月");
  });

  it("drops the zero part and pluralises", () => {
    expect(formatDuration("2025-01", "2025-03", "en")).toBe("3 mos");
    expect(formatDuration("2025-01", "2025-12", "en")).toBe("1 yr");
    expect(formatDuration("2024-01", "2025-12", "en")).toBe("2 yrs");
    expect(formatDuration("2024-01", "2025-12", "ja")).toBe("2年");
  });

  it("single month", () => {
    expect(formatDuration("2024-03", "2024-03", "en")).toBe("1 mo");
    expect(formatDuration("2024-03", "2024-03", "vi")).toBe("1 tháng");
    expect(formatDuration("2024-03", "2024-03", "ja")).toBe("1か月");
  });

  it("open-ended uses now", () => {
    const now = new Date(2026, 9, 30);
    expect(monthsBetween("2026-04", null, now)).toBe(7);
    expect(formatDuration("2025-08", null, "en", now)).toBe("1 yr 3 mos");
  });
});

describe("formatDuration with precompiled messages", () => {
  it("fills {count} in the parsed form the production build ships", async () => {
    vi.resetModules();
    vi.doMock("@/messages/en.json", async (importOriginal) => {
      const actual = (await importOriginal()) as {
        default: typeof import("@/messages/en.json");
      };
      const en = structuredClone(actual.default);
      (en.common.duration as unknown as Record<string, unknown>) = {
        yearOne: [["count"], " yr"],
        yearOther: [["count"], " yrs"],
        monthOne: [["count"], " mo"],
        monthOther: [["count"], " mos"],
      };
      return { default: en };
    });
    const { formatDuration: compiled } = await import("@/lib/format");
    expect(compiled("2025-08", "2026-09", "en")).toBe("1 yr 2 mos");
    vi.doUnmock("@/messages/en.json");
  });
});

describe("kanjiYear", () => {
  it("writes a year digit by digit in kanji numerals", () => {
    expect(kanjiYear(2026)).toBe("二〇二六");
    expect(kanjiYear(2019)).toBe("二〇一九");
    expect(kanjiYear(1987)).toBe("一九八七");
  });
});
