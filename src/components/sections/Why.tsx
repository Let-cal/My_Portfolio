import { useTranslations } from "next-intl";
import { ScrollTextReveal } from "@/components/fx/ScrollTextReveal";
import type { Content, Locale } from "@/content/schema";
import { pickLocale } from "@/lib/i18n-text";
import { WhyCarousel } from "./why/WhyCarousel";
import type { WhyCardView } from "./why/WhyCard";

/**
 * Why Hire Me section ("the koi becomes a dragon"). A manifesto sentence that lights up word by word while it
 * scrolls past, then the draggable card carousel. Server component: it orders the cards by sortIndex and picks the
 * locale for every string, so the client carousel receives plain view-models.
 */
export function Why({ content, locale }: { content: Content; locale: Locale }) {
  const t = useTranslations("why");
  const ts = useTranslations("sections");

  const cards = [...content.whyCards]
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map(
      (c): WhyCardView => ({
        id: c.id,
        title: pickLocale(c.title, locale),
        subtitle: pickLocale(c.subtitle, locale),
        tag: pickLocale(c.tag, locale),
        body: pickLocale(c.body, locale),
        colors: c.colors,
        evidenceLink: c.evidenceLink,
        stat: c.stat
          ? { value: c.stat.value, prefix: c.stat.prefix, suffix: c.stat.suffix, label: pickLocale(c.stat.label, locale) }
          : null,
      }),
    );

  return (
    <section id="why" aria-labelledby="why-heading" className="relative mx-auto max-w-6xl scroll-mt-14 px-4 py-24 sm:px-6">
      <h2 id="why-heading" className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
        {ts("why")}
      </h2>
      <div data-manifesto="" className="mt-10 max-w-4xl">
        <ScrollTextReveal
          text={t("manifesto")}
          locale={locale}
          className="font-heading text-2xl leading-snug font-medium tracking-tight text-balance sm:text-3xl md:text-4xl"
        />
      </div>
      <WhyCarousel cards={cards} />
    </section>
  );
}
