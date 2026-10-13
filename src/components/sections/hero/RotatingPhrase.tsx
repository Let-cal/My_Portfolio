"use client";

import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";

const INTERVAL_MS = 2200;

/** One rotating word. Only the word that is present (not leaving) carries `data-phrase-current`. */
function Word({ text }: { text: string }) {
  const present = useIsPresent();
  return (
    <motion.span
      data-phrase-current={present ? "" : undefined}
      className="inline-block whitespace-nowrap"
      initial={{ y: "70%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "-70%", opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {text}
    </motion.span>
  );
}

/**
 * "I build {web apps | AI agents | IoT locker systems} for Japanese clients": the middle words take turns every
 * 2.2 s with a short vertical slide. Reduced motion keeps the first one. The sentence comes from messages
 * (`hero.phrase` with an `<item>` tag, the words in `hero.phraseItems`), so word order follows each language.
 */
export function RotatingPhrase({ className }: { className?: string }) {
  const t = useTranslations("hero");
  const reduced = usePrefersReducedMotion();
  const items = t.raw("phraseItems") as string[];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced || items.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), INTERVAL_MS);
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
              <AnimatePresence mode="popLayout" initial={false}>
                <Word key={index} text={items[index]} />
              </AnimatePresence>
            </span>
          ),
      })}
    </p>
  );
}
