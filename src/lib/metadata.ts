import type { Metadata } from "next";
import type { Locale, Profile } from "@/content/schema";

export const SITE_TITLES: Record<Locale, string> = {
  en: "Le Tran Cat Lam · Software Engineer Portfolio",
  ja: "レ・チャン・カット・ラム · ソフトウェアエンジニア ポートフォリオ",
  vi: "Lê Trần Cát Lâm · Portfolio Kỹ sư Phần mềm",
};

const OG_LOCALE: Record<Locale, string> = { en: "en_US", ja: "ja_JP", vi: "vi_VN" };

export function getSiteUrl(): URL {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://letcal.is-a.dev");
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS");
  return new URL("/", url);
}

export function buildPageMetadata(locale: Locale, description: string): Metadata {
  const title = SITE_TITLES[locale];
  return {
    metadataBase: getSiteUrl(),
    title,
    description,
    alternates: {
      canonical: `/${locale}`,
      languages: { en: "/en", ja: "/ja", vi: "/vi", "x-default": "/en" },
    },
    openGraph: {
      type: "website", title, description, siteName: "LETCAL", url: `/${locale}`,
      locale: OG_LOCALE[locale], alternateLocale: Object.values(OG_LOCALE).filter((value) => value !== OG_LOCALE[locale]),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function buildPersonJsonLd(profile: Pick<Profile, "name" | "linkedin" | "github">, jobTitle: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    jobTitle,
    url: getSiteUrl().toString(),
    sameAs: [profile.linkedin, profile.github],
    knowsLanguage: ["vi", "en", "ja"],
  };
}

/** Content may later come from admin CRUD; never allow a string to close its script element. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
