import type { MetadataRoute } from "next";
import { LOCALES } from "@/content/constants";
import { getSiteUrl } from "@/lib/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const languages = Object.fromEntries(
    LOCALES.map((locale) => [locale, new URL(`/${locale}`, base).toString()]),
  );
  // Printable /quick variants are deliberately noindex; only canonical searchable pages belong here.
  return LOCALES.map((locale) => ({
    url: new URL(`/${locale}`, base).toString(),
    alternates: { languages },
  }));
}
