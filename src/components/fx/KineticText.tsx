"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-media-query";

type KineticTextProps = {
  as?: "h1" | "h2" | "span";
  text: string;
  /** Delay between two consecutive characters. */
  staggerMs?: number;
  className?: string;
};

/** User-perceived characters: a base letter keeps its combining marks, an emoji sequence stays whole. */
function graphemes(s: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s), (seg) => seg.segment);
  }
  return Array.from(s);
}

/**
 * Per-character entrance. Every character is an aria-hidden span (`data-char`); the real text sits in an
 * sr-only span, so assistive tech reads one clean string. Characters are split by grapheme (decomposed
 * Vietnamese diacritics and emoji stay attached). Space-separated text is grouped per word, and the space that
 * follows a word stays inside its group, so lines only wrap between words and a wrapped line never starts with
 * a blank; text without spaces (Japanese) is left flat so it can wrap between any two characters.
 * Reduced motion renders the letters in place without the animation.
 */
export function KineticText({ as: Tag = "span", text, staggerMs = 35, className }: KineticTextProps) {
  const reduced = usePrefersReducedMotion();
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
        ? text.split(" ").map((word, w, words) => (
            <span key={w} aria-hidden="true" className="inline-block whitespace-nowrap">
              {graphemes(word).map((ch) => renderChar(ch))}
              {w < words.length - 1 && renderChar(" ", "whitespace-pre")}
            </span>
          ))
        : graphemes(text).map((ch) => renderChar(ch))}
    </Tag>
  );
}
