"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "./use-media-query";

type NumberTickerProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  className?: string;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const numberFormats = new Map<number, Intl.NumberFormat>();
function formatterFor(decimals: number) {
  let formatter = numberFormats.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    numberFormats.set(decimals, formatter);
  }
  return formatter;
}

function decimalsOf(n: number) {
  const s = String(n);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

/**
 * Counts from 0 to `value` when scrolled into view. Server HTML and reduced motion show the final value;
 * the accessible label always carries the final text, so a screen reader never hears a half-counted number.
 *
 * No layout shift: the final text is rendered invisibly in the same grid cell as the counting text, so the
 * element is always as wide as the final value (digit and comma count never change its width).
 */
export function NumberTicker({ value, prefix = "", suffix = "", durationMs = 1200, className }: NumberTickerProps) {
  const reduced = usePrefersReducedMotion();
  const nodeRef = useRef<HTMLSpanElement>(null);
  const decimals = decimalsOf(value);
  const formatter = formatterFor(decimals);
  const format = (n: number) =>
    `${prefix}${formatter.format(n)}${suffix}`;
  const finalText = format(value);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const format = (n: number) => `${prefix}${formatter.format(n)}${suffix}`;
    node.textContent = finalText;
    if (reduced || typeof IntersectionObserver === "undefined") return;
    let frame = 0;
    // Hydration rendered the final value (no mismatch); rewind it so the count has somewhere to start.
    node.textContent = format(0);
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        node.textContent = format(value * easeOutCubic(t));
        if (t < 1) frame = requestAnimationFrame(tick);
        else node.textContent = finalText;
      };
      frame = requestAnimationFrame(tick);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduced, value, durationMs, formatter, prefix, suffix, finalText]);

  return (
    <span role="img" aria-label={finalText} className={`inline-grid tabular-nums${className ? ` ${className}` : ""}`}>
      <span aria-hidden="true" data-ticker-reserve="" className="invisible col-start-1 row-start-1">
        {finalText}
      </span>
      <span ref={nodeRef} aria-hidden="true" data-ticker-value="" className="col-start-1 row-start-1">
        {finalText}
      </span>
    </span>
  );
}
