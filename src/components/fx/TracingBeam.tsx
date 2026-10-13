"use client";

import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-media-query";

type TracingBeamProps = {
  children: ReactNode;
  className?: string;
  /** Position and size of the rail column; the default sits on the timeline's river column. */
  railClassName?: string;
};

/** Same column the static river used: 2rem on phones, the 3rem track after the 9.5rem date column from md up. */
const RAIL = "left-0 w-8 md:left-[9.5rem] md:w-12";

/**
 * Wraps a vertical list with a beam that fills as the visitor scrolls through it: a faint track runs the full
 * height, a teal-to-`--role-accent` stroke fills from the top to the scroll progress of the wrapper, and a glowing
 * dot marks the head. `data-progress` mirrors the progress (0..1); under reduced motion the beam is full and static.
 */
export function TracingBeam({
  children,
  className,
  railClassName = RAIL,
}: TracingBeamProps) {
  const reduced = usePrefersReducedMotion();
  const gradient = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: rootRef,
    offset: ["start 70%", "end 50%"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });
  const headTop = useTransform(
    progress,
    (v) => `${Math.min(1, Math.max(0, v)) * 100}%`,
  );

  // The attribute is written straight to the DOM so scrolling never re-renders the list.
  const write = (value: number) => {
    rootRef.current?.setAttribute(
      "data-progress",
      Math.min(1, Math.max(0, value))
        .toFixed(3)
        .replace(/\.?0+$/, "") || "0",
    );
  };
  useMotionValueEvent(progress, "change", (v) => {
    if (!reduced) write(v);
  });
  useEffect(() => {
    if (!reduced) write(progress.get());
  }, [reduced, progress]);

  return (
    <div
      ref={rootRef}
      data-tracing-beam=""
      data-progress={reduced ? "1" : undefined}
      className={cn("relative", className)}
    >
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-y-0", railClassName)}
      >
        <svg
          data-river
          aria-hidden
          viewBox="0 0 48 1000"
          preserveAspectRatio="none"
          className="size-full overflow-visible drop-shadow-[0_0_6px_color-mix(in_srgb,var(--role-accent,#f97316)_55%,transparent)]"
        >
          <defs>
            <linearGradient
              id={gradient}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="0"
              y2="1000"
            >
              <stop offset="0" stopColor="#2dd4bf" />
              <stop
                offset="1"
                style={{ stopColor: "var(--role-accent, #f97316)" }}
              />
            </linearGradient>
          </defs>
          <path
            d="M24 0V1000"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="text-border"
          />
          <motion.path
            d="M24 0V1000"
            fill="none"
            stroke={`url(#${gradient})`}
            strokeWidth={3}
            style={{ pathLength: reduced ? 1 : progress }}
          />
        </svg>
        <motion.span
          data-beam-head=""
          className="absolute left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--role-accent,#f97316)] shadow-[0_0_14px_3px_var(--role-accent,#f97316)]"
          style={{ top: reduced ? "100%" : headTop }}
        />
      </div>
      {children}
    </div>
  );
}
