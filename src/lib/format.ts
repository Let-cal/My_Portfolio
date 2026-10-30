import type { Locale } from "@/content/schema";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import vi from "@/messages/vi.json";

const PRESENT: Record<Locale, string> = {
  en: en.common.present,
  ja: ja.common.present,
  vi: vi.common.present,
};

const DURATION: Record<Locale, typeof en.common.duration> = {
  en: en.common.duration,
  ja: ja.common.duration,
  vi: vi.common.duration,
};

const EN_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** `YYYY-MM` as a short month label in `locale`: "Apr 2026", "2026年4月", "Th4 2026". */
export function formatMonth(ym: string, locale: Locale): string {
  const [year, month] = ym.split("-");
  const m = Number(month);
  if (locale === "ja") return `${year}年${m}月`;
  if (locale === "vi") return `Th${m} ${year}`;
  return `${EN_MONTHS[m - 1]} ${year}`;
}

/**
 * A date range such as "Apr 2026 – Sep 2026" (spaced en dash). `end === null` prints the localized
 * "present" word; a range inside a single month collapses to one date.
 */
export function formatPeriod(
  start: string,
  end: string | null,
  locale: Locale,
): string {
  if (end === start) return formatMonth(start, locale);
  return `${formatMonth(start, locale)} – ${end === null ? PRESENT[locale] : formatMonth(end, locale)}`;
}

/** `YYYY-MM` as a running month number (year * 12 + month index), for month arithmetic. */
export function monthIndex(ym: string): number {
  const [year, month] = ym.split("-");
  return Number(year) * 12 + Number(month) - 1;
}

/** The month of `now` as `YYYY-MM`. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Months from `start` to `end`, both months counted: 2025-08 .. 2026-09 is 14, one month alone is 1.
 * `end === null` runs up to the current month (`now`). Never below 1.
 */
export function monthsBetween(
  start: string,
  end: string | null,
  now: Date = new Date(),
): number {
  return Math.max(
    1,
    monthIndex(end ?? currentMonth(now)) - monthIndex(start) + 1,
  );
}

/**
 * `{count}` filled in a duration message. The production build precompiles message JSON (next-intl `precompile`),
 * so a message with an argument arrives as its parsed form, e.g. `[["count"], " yr"]`, rather than the source
 * string the tests and the dev server see; both are handled.
 */
function fill(message: unknown, count: number): string {
  if (typeof message === "string")
    return message.replace("{count}", String(count));
  if (Array.isArray(message))
    return message
      .map((part) => (typeof part === "string" ? part : String(count)))
      .join("");
  return String(message);
}

/**
 * A span as years and months: "1 yr 2 mos", "3 mos", "1 yr" (EN), "1 năm 2 tháng" (VI), "1年2か月" (JA). The
 * zero part is left out; months are counted inclusively (see `monthsBetween`).
 */
export function formatDuration(
  start: string,
  end: string | null,
  locale: Locale,
  now: Date = new Date(),
): string {
  const total = monthsBetween(start, end, now);
  const years = Math.floor(total / 12);
  const months = total % 12;
  const words = DURATION[locale];
  const part = (n: number, one: string, other: string) =>
    fill(n === 1 ? one : other, n);
  const parts = [
    ...(years > 0 ? [part(years, words.yearOne, words.yearOther)] : []),
    ...(months > 0 ? [part(months, words.monthOne, words.monthOther)] : []),
  ];
  return parts.join(locale === "ja" ? "" : " ");
}

/**
 * A position text cut before its first "—", ",", "(", "（" or "、", trimmed:
 * "Software Engineer — acting Project Manager" -> "Software Engineer".
 */
export function shortTitle(position: string): string {
  const cut = position.search(/[—,(（、]/);
  return (cut === -1 ? position : position.slice(0, cut)).trim();
}

const KANJI_DIGITS = "〇一二三四五六七八九";

/** A year written digit by digit in kanji numerals, as on a seal: 2026 -> "二〇二六". */
export function kanjiYear(year: number): string {
  return String(year).replace(/\d/g, (d) => KANJI_DIGITS[Number(d)]);
}
