import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Certificates } from "@/components/sections/Certificates";
import { Contact } from "@/components/sections/Contact";
import { Experience } from "@/components/sections/Experience";
import { Hero } from "@/components/sections/Hero";
import { Projects } from "@/components/sections/Projects";
import { Skills } from "@/components/sections/Skills";
import { Why } from "@/components/sections/Why";
import { WaveEdge } from "@/components/fx/WaveEdge";
import { SectionLabel } from "@/components/site/SectionLabel";
import { SECTION_CHAPTERS, SECTION_IDS } from "@/components/site/sections";
import { routing } from "@/i18n/routing";
import { getContent } from "@/lib/data/get-content";
import { KoiCanvas } from "@/scene/KoiCanvas";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("sections");
  const tn = await getTranslations("nav");
  const content = await getContent();

  // Each section after the hero sits in a `relative` wrapper that carries its chapter label, with a slow
  // water wave on top as the divider. Section backgrounds stay transparent for the 3D canvas behind.
  return (
    <main id="main" className="flex-1">
      {/* Portals itself to <body> as a fixed layer behind the content; renders nothing here. */}
      <KoiCanvas />
      {SECTION_IDS.map((id) => {
        const section =
          id === "hero" ? (
            <Hero content={content} locale={locale} />
          ) : id === "experience" ? (
            <Experience content={content} locale={locale} />
          ) : id === "projects" ? (
            <Projects content={content} locale={locale} />
          ) : id === "skills" ? (
            <Skills content={content} locale={locale} />
          ) : id === "certificates" ? (
            <Certificates content={content} locale={locale} />
          ) : id === "why" ? (
            <Why content={content} locale={locale} />
          ) : id === "contact" ? (
            <Contact content={content} locale={locale} />
          ) : (
            <section id={id} aria-labelledby={`${id}-heading`} className="mx-auto max-w-6xl scroll-mt-14 px-4 py-24 sm:px-6">
              <h2 id={`${id}-heading`} className="text-3xl font-semibold">
                {t(id)}
              </h2>
            </section>
          );
        const chapter = SECTION_CHAPTERS[id];
        return (
          <div key={id} className={id === "hero" ? "relative" : "portfolio-chapter relative"}>
            {id !== "hero" && <WaveEdge className="text-foreground/[0.05] [mask-image:linear-gradient(to_bottom,#000_15%,transparent)]" />}
            <SectionLabel index={chapter.index} title={tn(id)} kanji={chapter.kanji} />
            {section}
          </div>
        );
      })}
    </main>
  );
}
