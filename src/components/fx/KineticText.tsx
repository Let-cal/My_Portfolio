"use client";

import { useMemo, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-media-query";
import { segmentKineticWords } from "./kinetic-words";

type KineticTextProps = {
  as?: "h1" | "h2" | "span";
  text: string;
  /** Words segmented from this exact text on the server; avoids browser Intl work. */
  preparedWords?: readonly (readonly string[])[];
  /** Delay between two consecutive characters. */
  staggerMs?: number;
  className?: string;
};

/**
 * Per-character entrance. Every character is an aria-hidden span (`data-char`); the real text sits in an
 * sr-only span, so assistive tech reads one clean string. Characters are split by grapheme (decomposed
 * Vietnamese diacritics and emoji stay attached). Space-separated text is grouped per word, and the space that
 * follows a word stays inside its group, so lines only wrap between words and a wrapped line never starts with
 * a blank; text without spaces (Japanese) is left flat so it can wrap between any two characters.
 * Reduced motion renders the letters in place without the animation.
 */
export function KineticText({ as: Tag = "span", text, preparedWords, staggerMs = 35, className }: KineticTextProps) {
  const reduced = usePrefersReducedMotion();
  const words = useMemo(() => preparedWords ?? segmentKineticWords(text), [text, preparedWords]);
  let index = 0;

  const charStyle = (i: number): CSSProperties | undefined =>
    reduced ? undefined : { animationDelay: `${i * staggerMs}ms` };
  const charClass = reduced ? "inline-block" : "fx-char inline-block";
  const renderChar = (ch: string, extra?: string) => (
    <span
      key={index}
      data-char=""
      aria-hidden="true"
      className={cn(charClass, extra)}
      style={charStyle(index++)}
    >
      {ch}
    </span>
  );

  const hasSpaces = text.includes(" ");

  return (
    <Tag className={className}>
      <span className="sr-only">{text}</span>
      {hasSpaces
        ? words.map((word, w) => (
            <span key={w} aria-hidden="true" className="inline-block whitespace-nowrap">
              {word.map((ch) => renderChar(ch))}
              {w < words.length - 1 && renderChar(" ", "whitespace-pre")}
            </span>
          ))
        : words[0].map((ch) => renderChar(ch))}
    </Tag>
  );
}
