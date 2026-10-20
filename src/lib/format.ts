import type { Locale } from "@/content/schema";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import vi from "@/messages/vi.json";

const PRESENT: Record<Locale, string> = {
  en: en.common.present,
  ja: ja.common.present,
  vi: vi.common.present,
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
