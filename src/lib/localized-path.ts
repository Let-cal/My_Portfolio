import type { Locale } from "@/content/schema";

/** This site uses three always-prefixed locales and identical pathnames in each language. */
export function localizedPath(pathname: string, locale: Locale) {
  const path = pathname.replace(/^\/(?:en|ja|vi)(?=\/|$)/, "");
  return `/${locale}${!path || path === "/" ? "" : path}`;
}
