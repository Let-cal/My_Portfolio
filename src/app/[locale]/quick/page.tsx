import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QuickMarkScript } from "@/components/quick/quick-mark";
import { QuickView } from "@/components/quick/QuickView";
import type { Locale } from "@/content/schema";
import { routing } from "@/i18n/routing";
import { getContent } from "@/lib/data/get-content";
import { parseRole } from "@/lib/roles";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/quick">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "quick" });
  return {
    title: t("metaTitle"),
    description: t("description"),
    robots: { index: false, follow: true },
    alternates: {
      canonical: `/${locale}`,
      languages: { en: "/en", ja: "/ja", vi: "/vi", "x-default": "/en" },
    },
  };
}

/**
 * `/[locale]/quick`: the printable 60-second view. The shell is prerendered per locale; `?role=` is read at
 * request time inside a Suspense boundary, as `cacheComponents` requires, and the content comes from the cache.
 */
export default async function QuickPage({
  params,
  searchParams,
}: PageProps<"/[locale]/quick">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("quick");

  return (
    <Suspense
      fallback={
        <main
          id="main"
          data-quick-view=""
          aria-busy="true"
          className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 text-muted-foreground"
        >
          <QuickMarkScript />
          <p role="status">{t("loading")}</p>
        </main>
      }
    >
      <Quick locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

async function Quick({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams: PageProps<"/[locale]/quick">["searchParams"];
}) {
  const [{ role }, content] = await Promise.all([searchParams, getContent()]);
  return (
    <QuickView
      content={content}
      locale={locale}
      role={parseRole(Array.isArray(role) ? role[0] : role)}
    />
  );
}
