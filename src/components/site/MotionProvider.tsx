"use client";

import { MotionConfig } from "motion/react";
import { useLayoutEffect, type ReactNode } from "react";
import { syncMotionAttribute, useReducedMotionEffective } from "./motion-preference";

/**
 * Makes the `motion` library follow the effective motion preference (instead of only the OS one) and
 * re-applies `data-motion` after a client-side locale switch, which swaps the root layout and creates a
 * fresh <html> that the pre-paint script does not run for again (same reason as ThemeSync).
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotionEffective();
  useLayoutEffect(() => {
    syncMotionAttribute();
  }, []);
  return <MotionConfig reducedMotion={reduced ? "always" : "never"}>{children}</MotionConfig>;
}
