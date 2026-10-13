"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "./use-media-query";

type NumberTickerProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  className?: string;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function decimalsOf(n: number) {
  const s = String(n);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

/**
 * Counts from 0 to `value` when scrolled into view. Server HTML and reduced motion show the final value;
 * the accessible label always carries the final text, so a screen reader never hears a half-counted number.
 */
export function NumberTicker({ value, prefix = "", suffix = "", durationMs = 1200, className }: NumberTickerProps) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(value);
  const [node, setNode] = useState<HTMLSpanElement | null>(null);
  const decimals = decimalsOf(value);
  const format = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  useEffect(() => {
    if (reduced || !node || typeof IntersectionObserver === "undefined") return;
    let frame = 0;
    // Hydration rendered the final value (no mismatch); rewind it so the count has somewhere to start.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(0);
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        setShown(value * easeOutCubic(t));
        if (t < 1) frame = requestAnimationFrame(tick);
        else setShown(value);
      };
      frame = requestAnimationFrame(tick);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [node, reduced, value, durationMs]);

  return (
    <span role="img" aria-label={`${prefix}${format(value)}${suffix}`} className={className}>
      {prefix}
      <span ref={setNode} className="tabular-nums">
        {format(shown)}
      </span>
      {suffix}
    </span>
  );
}
