import type { MetadataRoute } from "next";
import { LOCALES } from "@/content/constants";
import { getSiteUrl } from "@/lib/metadata";

/** Paths after the locale of every indexable page: the home page and the project archive. */
const PAGES = ["", "/projects"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  // Printable /quick variants are deliberately noindex; only canonical searchable pages belong here.
  return PAGES.flatMap((path) => {
    const languages = Object.fromEntries(
      LOCALES.map((locale) => [
        locale,
        new URL(`/${locale}${path}`, base).toString(),
      ]),
    );
    return LOCALES.map((locale) => ({
      url: new URL(`/${locale}${path}`, base).toString(),
      alternates: { languages },
    }));
  });
}
