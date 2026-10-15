"use client";

import * as motion from "motion/react-m";
import { useScroll, useTransform, type MotionValue } from "motion/react";
import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-media-query";

/** Dimmest a word gets before the scroll reaches it; kept well above invisible so the sentence stays readable. */
export const SCROLL_REVEAL_MIN_OPACITY = 0.65;

type Token = { text: string; unit: number | null };

/**
 * Splits `text` into reveal units and the whitespace between them. Uses word-granularity Intl.Segmenter so
 * unspaced scripts (Japanese) still progress word by word; falls back to whitespace splitting without it.
 */
function tokenize(text: string, locale?: string): Token[] {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
    return numbered(Array.from(segmenter.segment(text), (s) => s.segment));
  }
  return numbered(text.split(/(\s+)/).filter(Boolean));
}

/** Gives every non-whitespace part its position among the reveal units (whitespace gets null). */
function numbered(parts: string[]): Token[] {
  let n = 0;
  return parts.map((part) => ({ text: part, unit: /\S/.test(part) ? n++ : null }));
}

function Word({ word, range, progress, reduced }: { word: string; range: [number, number]; progress: MotionValue<number>; reduced: boolean }) {
  const opacity = useTransform(progress, range, [SCROLL_REVEAL_MIN_OPACITY, 1]);
  return (
    // Reduced motion pins the opacity to 1 explicitly: dropping the style would leave the last scroll-driven value
    // that motion already wrote (the server HTML hydrates before the media query is known).
    <motion.span data-reveal-unit="" style={{ opacity: reduced ? 1 : opacity }}>
      {word}
    </motion.span>
  );
}

/**
 * Each word (or Japanese word segment) fades from 0.65 to 1 as the paragraph scrolls through the viewport, so words
 * light up in reading order. Reduced motion shows the whole text at full opacity. Screen readers get the sentence
 * once as sr-only text; the animated copy is aria-hidden.
 */
export function ScrollTextReveal({ text, locale, className }: { text: string; locale?: string; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "end 0.5"] });
  const tokens = useMemo(() => tokenize(text, locale), [text, locale]);
  const total = tokens.filter((t) => t.unit !== null).length;

  return (
    <p ref={ref} lang={locale} className={cn(className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {tokens.map((token, i) => {
          if (token.unit === null) return token.text;
          const start = token.unit / total;
          const end = Math.min(1, start + 1 / total);
          return <Word key={`${token.text}-${i}`} word={token.text} range={[start, end]} progress={scrollYProgress} reduced={reduced} />;
        })}
      </span>
    </p>
  );
}
