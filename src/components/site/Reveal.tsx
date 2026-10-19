"use client";

import * as motion from "motion/react-m";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";

/**
 * Fades a block in and lifts it 24px the first time it scrolls into view (`whileInView`, once). Under the
 * effective reduced-motion preference it is a plain static wrapper. Server-rendered HTML starts hidden; the
 * pre-paint `data-motion="reduced"` rule in globals.css shows it at once for visitors who reduce motion.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return (
      <div data-reveal="" className={className}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      data-reveal=""
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
