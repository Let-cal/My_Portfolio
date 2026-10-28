import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPageMetadata,
  buildPersonJsonLd,
  serializeJsonLd,
} from "@/lib/metadata";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import manifest from "@/app/manifest";

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://letcal.is-a.dev"));
afterEach(() => vi.unstubAllEnvs());

describe("portfolio search identity", () => {
  it("uses the approved Japanese title and canonical language alternatives", () => {
    const metadata = buildPageMetadata("ja", "Japanese portfolio description");
    expect(metadata.title).toBe(
      "レ・チャン・カット・ラム · ソフトウェアエンジニア ポートフォリオ",
    );
    expect(metadata.metadataBase?.toString()).toBe("https://letcal.is-a.dev/");
    expect(metadata.alternates).toMatchObject({
      canonical: "/ja",
      languages: { en: "/en", ja: "/ja", vi: "/vi", "x-default": "/en" },
    });
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      url: "/ja",
      locale: "ja_JP",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it.each([
    ["en", "Le Tran Cat Lam · Software Engineer Portfolio"],
    ["vi", "Lê Trần Cát Lâm · Portfolio Kỹ sư Phần mềm"],
  ] as const)("uses the approved %s title", (locale, title) => {
    expect(buildPageMetadata(locale, "Description").title).toBe(title);
  });

  it("allows public pages and excludes admin crawling", () => {
    expect(robots()).toMatchObject({
      rules: { userAgent: "*", allow: "/", disallow: "/admin" },
      sitemap: "https://letcal.is-a.dev/sitemap.xml",
    });
  });

  it("lists only the indexable language pages (home and project archive) in the sitemap", () => {
    expect(sitemap().map(({ url }) => url)).toEqual([
      "https://letcal.is-a.dev/en",
      "https://letcal.is-a.dev/ja",
      "https://letcal.is-a.dev/vi",
      "https://letcal.is-a.dev/en/projects",
      "https://letcal.is-a.dev/ja/projects",
      "https://letcal.is-a.dev/vi/projects",
    ]);
    expect(sitemap()[0].alternates?.languages).toMatchObject({
      ja: "https://letcal.is-a.dev/ja",
    });
  });

  it("identifies the person without exposing a phone number", () => {
    const person = buildPersonJsonLd(
      {
        name: "Le Tran Cat Lam",
        github: "https://github.com/Let-cal",
        linkedin: "https://www.linkedin.com/in/letcal",
      },
      "Software Engineer",
    );
    expect(person).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Le Tran Cat Lam",
      jobTitle: "Software Engineer",
      url: "https://letcal.is-a.dev/",
      knowsLanguage: ["vi", "en", "ja"],
      sameAs: [
        "https://www.linkedin.com/in/letcal",
        "https://github.com/Let-cal",
      ],
    });
    expect(person).not.toHaveProperty("telephone");
  });

  it("escapes markup in structured data before embedding a script", () => {
    const serialized = serializeJsonLd({
      name: "</script><script>alert(1)</script>",
    });
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized).name).toBe(
      "</script><script>alert(1)</script>",
    );
  });

  it("serves the koi identity in the browser manifest", () => {
    expect(manifest()).toMatchObject({
      short_name: "LETCAL",
      start_url: "/en",
    });
    expect(manifest().icons).toContainEqual({
      src: "/icon.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any",
    });
  });
});
