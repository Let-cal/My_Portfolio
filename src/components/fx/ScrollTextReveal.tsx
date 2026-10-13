"use client";

import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-media-query";

const MIN_OPACITY = 0.15;

function Word({ word, range, progress, reduced }: { word: string; range: [number, number]; progress: MotionValue<number>; reduced: boolean }) {
  const opacity = useTransform(progress, range, [MIN_OPACITY, 1]);
  return (
    <motion.span style={reduced ? undefined : { opacity }} className="inline-block">
      {word}
    </motion.span>
  );
}

/**
 * Each word fades from 0.15 to 1 as the paragraph scrolls through the viewport (words light up in reading
 * order). Reduced motion shows the whole text at full opacity.
 */
export function ScrollTextReveal({ text, className }: { text: string; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "end 0.5"] });
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <p ref={ref} className={cn("flex flex-wrap gap-x-[0.3em]", className)}>
      {words.map((word, i) => {
        const start = i / words.length;
        const end = Math.min(1, start + 1 / words.length);
        return <Word key={`${word}-${i}`} word={word} range={[start, end]} progress={scrollYProgress} reduced={reduced} />;
      })}
    </p>
  );
}
