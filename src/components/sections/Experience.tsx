import { useTranslations } from "next-intl";
import type { Content, Locale } from "@/content/schema";
import { buildJourney } from "@/lib/journey";
import { JourneyTree } from "./experience/JourneyTree";
import "./experience/journey.css";
import { Reveal } from "@/components/site/Reveal";

/**
 * Experience section: the journey tree. Companies (with their position stints) and schools are the parents, their
 * work / university projects the children; every string is picked for the locale here, so no other locale's text
 * ships to the client.
 */
export function Experience({
  content,
  locale,
  now,
}: {
  content: Content;
  locale: Locale;
  /** The month open-ended spans run up to; the prerendered page passes a cached date. */
  now?: Date;
}) {
  const ts = useTranslations("sections");
  const tp = useTranslations("projects");
  const parents = buildJourney(
    content,
    locale,
    (key) => tp(key as "code" | "demo"),
    now,
  );

  return (
    <section
      id="experience"
      aria-labelledby="experience-heading"
      className="relative mx-auto max-w-6xl scroll-mt-14 px-4 py-24 sm:px-6"
    >
      <Reveal>
        <h2
          id="experience-heading"
          data-scene-avoid=""
          className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {ts("experience")}
        </h2>
      </Reveal>
      <div className="mt-10">
        <JourneyTree parents={parents} />
      </div>
    </section>
  );
}
