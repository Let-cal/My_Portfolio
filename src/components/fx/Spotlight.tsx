"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "./use-media-query";
import { usePointerFine } from "./use-pointer-fine";

/**
 * Full-page glow that follows the pointer. The position is written to CSS variables inside a
 * requestAnimationFrame callback, so a mouse move never triggers a React render.
 */
export function Spotlight() {
  const fine = usePointerFine();
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const active = fine && !reduced;

  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const flush = () => {
      frame = 0;
      el.style.setProperty("--fx-spot-x", `${x}px`);
      el.style.setProperty("--fx-spot-y", `${y}px`);
      el.style.opacity = "1";
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const onLeave = () => {
      el.style.opacity = "0";
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [active]);

  if (!active) return null;
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 opacity-0 transition-opacity duration-300"
      style={{
        background:
          "radial-gradient(600px circle at var(--fx-spot-x, 50%) var(--fx-spot-y, 50%), rgb(249 115 22 / .10), transparent 80%)",
      }}
    />
  );
}
