"use client";

import { Fragment, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-media-query";

type KineticTextProps = {
  as?: "h1" | "h2" | "span";
  text: string;
  /** Delay between two consecutive characters. */
  staggerMs?: number;
  className?: string;
};

/**
 * Per-character entrance. Every character is an aria-hidden span (`data-char`); the real text sits in an
 * sr-only span, so assistive tech reads one clean string. Characters are grouped per word so lines only
 * wrap between words. Reduced motion renders the letters in place without the animation.
 */
export function KineticText({ as: Tag = "span", text, staggerMs = 35, className }: KineticTextProps) {
  const reduced = usePrefersReducedMotion();
  let index = 0;

  const charStyle = (i: number): CSSProperties | undefined =>
    reduced ? undefined : { animationDelay: `${i * staggerMs}ms` };
  const charClass = reduced ? "inline-block" : "fx-char inline-block";

  return (
    <Tag className={className}>
      <span className="sr-only">{text}</span>
      {text.split(" ").map((word, w) => (
        <Fragment key={w}>
          {w > 0 && (
            <span data-char="" aria-hidden="true" className={cn("whitespace-pre", charClass)} style={charStyle(index++)}>
              {" "}
            </span>
          )}
          <span aria-hidden="true" className="inline-block whitespace-nowrap">
            {Array.from(word).map((ch, c) => (
              <span key={c} data-char="" aria-hidden="true" className={charClass} style={charStyle(index++)}>
                {ch}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </Tag>
  );
}
