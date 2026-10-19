"use client";

import { MotionConfig } from "motion/react";

/** Admin animations are short (150–250 ms) and switch off when the OS asks for reduced motion. */
export function AdminMotion({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
    >
      {children}
    </MotionConfig>
  );
}
