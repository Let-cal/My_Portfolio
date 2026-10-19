"use client";

import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-media-query";
import { useScrollEnhancement } from "./use-scroll-enhancement";
import { tokenizeScrollText, type ScrollToken } from "./scroll-tokens";

/** Dimmest a word gets before the scroll reaches it; kept well above invisible so the sentence stays readable. */
export const SCROLL_REVEAL_MIN_OPACITY = 0.65;

function Word({ word, reduced }: { word: string; reduced: boolean }) {
  return (
    // Reduced motion pins the opacity to 1 explicitly: dropping the style would leave the last scroll-driven value
    // that motion already wrote (the server HTML hydrates before the media query is known).
    <span
      data-reveal-unit=""
      style={{ opacity: reduced ? 1 : SCROLL_REVEAL_MIN_OPACITY }}
    >
      {word}
    </span>
  );
}

/**
 * Each word (or Japanese word segment) fades from 0.65 to 1 as the paragraph scrolls through the viewport, so words
 * light up in reading order. Reduced motion shows the whole text at full opacity. Screen readers get the sentence
 * once as sr-only text; the animated copy is aria-hidden.
 */
export function ScrollTextReveal({
  text,
  locale,
  className,
  preparedTokens,
}: {
  text: string;
  locale?: string;
  className?: string;
  preparedTokens?: readonly ScrollToken[];
}) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLParagraphElement>(null);
  useScrollEnhancement(ref, "words", reduced, text);
  const tokens = useMemo(
    () => preparedTokens ?? tokenizeScrollText(text, locale),
    [text, locale, preparedTokens],
  );

  return (
    <p ref={ref} lang={locale} className={cn(className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {tokens.map((token, i) => {
          if (token.unit === null) return token.text;
          return (
            <Word
              key={`${token.text}-${i}`}
              word={token.text}
              reduced={reduced}
            />
          );
        })}
      </span>
    </p>
  );
}
