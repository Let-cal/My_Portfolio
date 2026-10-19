import { useTranslations } from "next-intl";
import { ScrollTextReveal } from "@/components/fx/ScrollTextReveal";
import { tokenizeScrollText } from "@/components/fx/scroll-tokens";
import type { Content, Locale } from "@/content/schema";
import { pickLocale } from "@/lib/i18n-text";
import { WhyCarousel } from "./why/WhyCarousel";
import { WhyCard, type WhyCardView } from "./why/WhyCard";
import { Reveal } from "@/components/site/Reveal";

/**
 * Why Hire Me section ("the koi becomes a dragon"). A manifesto sentence that lights up word by word while it
 * scrolls past, then the draggable card carousel. Server component: it orders the cards by sortIndex and picks the
 * locale for every string, so the client carousel receives plain view-models.
 */
export function Why({ content, locale }: { content: Content; locale: Locale }) {
  const t = useTranslations("why");
  const ts = useTranslations("sections");
  const manifesto = t("manifesto");

  const cards = [...content.whyCards]
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((c): WhyCardView => ({
      id: c.id,
      title: pickLocale(c.title, locale),
      subtitle: pickLocale(c.subtitle, locale),
      tag: pickLocale(c.tag, locale),
      body: pickLocale(c.body, locale),
      colors: c.colors,
      evidenceLink: c.evidenceLink,
      stat: c.stat
        ? {
            value: c.stat.value,
            prefix: c.stat.prefix,
            suffix: c.stat.suffix,
            label: pickLocale(c.stat.label, locale),
          }
        : null,
    }));

  return (
    <section
      id="why"
      aria-labelledby="why-heading"
      className="relative mx-auto max-w-6xl scroll-mt-14 px-4 py-24 sm:px-6"
    >
      <Reveal>
        <h2
          id="why-heading"
          data-scene-avoid=""
          className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {ts("why")}
        </h2>
      </Reveal>
      <div data-manifesto="" data-scene-avoid="" className="mt-10 max-w-4xl">
        <ScrollTextReveal
          text={manifesto}
          preparedTokens={tokenizeScrollText(manifesto, locale)}
          locale={locale}
          className="font-heading text-2xl leading-snug font-medium tracking-tight text-balance sm:text-3xl md:text-4xl"
        />
      </div>
      <WhyCarousel
        cards={cards.map((card) => ({
          id: card.id,
          content: <WhyCard card={card} evidenceLabel={t("seeEvidence")} />,
        }))}
      />
    </section>
  );
}
