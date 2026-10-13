import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Hero } from "@/components/sections/Hero";
import { SECTION_IDS } from "@/components/site/sections";
import { routing } from "@/i18n/routing";
import { getContent } from "@/lib/data/get-content";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("sections");
  const content = await getContent();

  // Tasks 6-11 replace each remaining placeholder <section> with its real component.
  return (
    <main id="main" className="flex-1">
      {SECTION_IDS.map((id) =>
        id === "hero" ? (
          <Hero key={id} content={content} locale={locale} />
        ) : (
          <section key={id} id={id} aria-labelledby={`${id}-heading`} className="mx-auto max-w-6xl scroll-mt-14 px-4 py-24 sm:px-6">
            <h2 id={`${id}-heading`} className="text-3xl font-semibold">
              {t(id)}
            </h2>
          </section>
        ),
      )}
    </main>
  );
}
