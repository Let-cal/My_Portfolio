import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SECTION_IDS } from "@/components/site/sections";
import { routing } from "@/i18n/routing";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("sections");

  // Empty shell: Tasks 5-11 replace each <section> body with its real component.
  return (
    <main id="main" className="flex-1">
      {SECTION_IDS.map((id) => (
        <section key={id} id={id} aria-labelledby={`${id}-heading`} className="mx-auto max-w-6xl scroll-mt-14 px-4 py-24 sm:px-6">
          {id === "hero" ? (
            <h1 id={`${id}-heading`} className="text-4xl font-semibold sm:text-6xl">
              {t(id)}
            </h1>
          ) : (
            <h2 id={`${id}-heading`} className="text-3xl font-semibold">
              {t(id)}
            </h2>
          )}
        </section>
      ))}
    </main>
  );
}
