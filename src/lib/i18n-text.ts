import type { I18nText, Locale } from "@/content/schema";

/** Text for `locale`; an empty or missing translation falls back to EN, no text gives ''. */
export function pickLocale(text: I18nText | null | undefined, locale: Locale): string {
  if (!text) return "";
  return text[locale] || text.en || "";
}
