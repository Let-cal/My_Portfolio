"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-media-query";
import { useNearViewportEffect } from "./use-near-viewport-effect";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  const setup = useCallback(() => {
    const track = trackRef.current;
    const copy = copyRef.current;
    if (!track || !copy || speed <= 0) return;
    let disposed = false;
    const apply = (width: number) => {
      if (disposed) return;
      if (width > 0) track.style.setProperty("--fx-marquee-duration", `${width / speed}s`);
    };
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        if (disposed) return;
        for (const entry of entries) {
          if (entry.target !== copy) continue;
          const size = Array.isArray(entry.borderBoxSize) ? entry.borderBoxSize[0] : entry.borderBoxSize as unknown as ResizeObserverSize | undefined;
          // Older RO implementations lack borderBoxSize; only that fallback needs a layout read.
          apply(size?.inlineSize ?? copy.getBoundingClientRect().width);
        }
      });
      observer.observe(copy, { box: "border-box" });
      return () => { disposed = true; observer.disconnect(); };
    }
    const measure = () => { if (!disposed) apply(copy.getBoundingClientRect().width); };
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.addEventListener("loadingdone", measure);
    return () => {
      disposed = true;
      window.removeEventListener("resize", measure);
      document.fonts?.removeEventListener("loadingdone", measure);
    };
  }, [speed]);
  // Motion changes may add/remove the second copy; keep the same measurement setup for the first copy.
  useNearViewportEffect(rootRef, setup);

  return (
    <div
      ref={rootRef}
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
