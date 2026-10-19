"use client";

import { useExitingValue } from "@/components/fx/use-exiting-value";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";

const INTERVAL_MS = 2200;

/**
 * "I build {web apps | AI agents | IoT locker systems} for Japanese clients": the middle words take turns every
 * 2.2 s with a short vertical slide. Reduced motion keeps the first one. The sentence comes from messages
 * (`hero.phrase` with an `<item>` tag, the words in `hero.phraseItems`), so word order follows each language.
 */
export function RotatingPhrase({ className }: { className?: string }) {
  const t = useTranslations("hero");
  const reduced = usePrefersReducedMotion();
  const items = [0, 1, 2].map((index) => t(`phraseItems.${index}`));
  const [index, setIndex] = useState(0);
  const { current, leaving, finish } = useExitingValue(index, reduced);

  useEffect(() => {
    if (reduced || items.length < 2) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % items.length),
      INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [reduced, items.length]);

  return (
    <p className={className}>
      {t.rich("phrase", {
        item: () =>
          reduced ? (
            <span data-phrase-current="" className="hero-phrase-word">
              {items[0]}
            </span>
          ) : (
            <span className="hero-phrase-word relative inline-flex overflow-hidden pb-[0.12em] align-bottom">
              {leaving.map((frame) => (
                <span
                  key={frame.key}
                  aria-hidden="true"
                  className="hero-word-exit absolute top-0 left-0 inline-block whitespace-nowrap"
                  onAnimationEnd={() => finish(frame.key)}
                >
                  {items[frame.value]}
                </span>
              ))}
              <span
                key={current.key}
                data-phrase-current=""
                className={`inline-block whitespace-nowrap${current.key > 0 ? " hero-word-enter" : ""}`}
              >
                {items[index]}
              </span>
            </span>
          ),
      })}
    </p>
  );
}
