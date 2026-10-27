"use client";

import { useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-media-query";
import { useScrollEnhancement } from "./use-scroll-enhancement";

type TracingBeamProps = {
  children: ReactNode;
  className?: string;
  /** Position and size of the rail column; the default sits on the timeline's river column. */
  railClassName?: string;
  /** Colour class of the faint full-height track under the beam; `text-transparent` lets a custom rail show. */
  trackClassName?: string;
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
  trackClassName = "text-border",
}: TracingBeamProps) {
  const reduced = usePrefersReducedMotion();
  const gradient = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollEnhancement(rootRef, "beam", reduced);

  return (
    <div
      ref={rootRef}
      data-tracing-beam=""
      data-progress={reduced ? "1" : "0"}
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
            className={trackClassName}
          />
          <path
            data-beam-path=""
            d="M24 0V1000"
            fill="none"
            stroke={`url(#${gradient})`}
            strokeWidth={3}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={reduced ? 0 : 1}
          />
        </svg>
        <span
          data-beam-head=""
          className="absolute left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--role-accent,#f97316)] shadow-[0_0_14px_3px_var(--role-accent,#f97316)]"
          style={{ top: reduced ? "100%" : "0%" }}
        />
      </div>
      {children}
    </div>
  );
}
