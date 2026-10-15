"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-media-query";

type MarqueeProps = {
  /** Scroll speed in px per second. */
  speed?: number;
  reverse?: boolean;
  pauseOnHover?: boolean;
  /** Repeated visual copy already represented elsewhere; never add it to keyboard navigation. */
  decorative?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Endless horizontal ticker. The content is rendered twice (the copy is aria-hidden) and the track slides
 * by one copy width; the duration is derived from the measured width so `speed` is real px/s.
 * Under reduced motion only one copy is shown and the row scrolls by hand.
 */
export function Marquee({ speed = 40, reverse = false, pauseOnHover = true, decorative = false, className, children }: MarqueeProps) {
  const reduced = usePrefersReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const copy = copyRef.current;
    if (!track || !copy || speed <= 0) return;
    const apply = () => {
      const width = copy.getBoundingClientRect().width;
      if (width > 0) track.style.setProperty("--fx-marquee-duration", `${width / speed}s`);
    };
    apply();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(apply);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [speed, reduced]);

  return (
    <div
      className={cn("fx-marquee flex w-full rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50", reduced ? "overflow-x-auto" : "overflow-hidden", className)}
      tabIndex={decorative ? -1 : reduced ? 0 : undefined}
      data-pause-on-hover={pauseOnHover ? "" : undefined}
    >
      <div
        ref={trackRef}
        className="fx-marquee-track flex w-max flex-none"
        data-reverse={reverse ? "" : undefined}
        data-static={reduced ? "" : undefined}
      >
        <div ref={copyRef} className="flex flex-none items-center gap-8 pr-8">
          {children}
        </div>
        {!reduced && (
          <div aria-hidden="true" className="flex flex-none items-center gap-8 pr-8">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
