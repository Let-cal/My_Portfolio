"use client";

import { useEffect, useRef, useState } from "react";

/** Tiny koi, head on the right (the thread's tip). Drawn in `currentColor`. */
function KoiIcon() {
  return (
    <svg
      data-icon="koi"
      viewBox="0 0 28 14"
      className="h-3.5 w-7"
      fill="currentColor"
      focusable="false"
    >
      <path d="M27 7c0 2.4-3.4 4.6-8 4.6-3.2 0-6-1-8-2.6L3.2 13c-.8.6-1.7-.1-1.4-1L3.6 7 1.8 2c-.3-.9.6-1.6 1.4-1L11 5.1c2-1.6 4.8-2.6 8-2.6 4.6 0 8 2.1 8 4.5Z" />
      <circle cx="23.2" cy="5.7" r="1" fill="var(--background, #0a0a0b)" />
    </svg>
  );
}

/** Tiny dragon: a serpentine body with a horned head on the right. */
function DragonIcon() {
  return (
    <svg
      data-icon="dragon"
      viewBox="0 0 36 14"
      className="h-3.5 w-9"
      fill="currentColor"
      focusable="false"
    >
      <path d="M1 9.5c3.5-5.5 6.5-5.5 9-2s5 3.5 8-.5c1.6-2.1 3.4-3.2 5.4-3.4L24.2 1l2.6 1.7c2.9.1 5.6 1.6 7.7 3.6l-1.7 1.5H29c-1.2 1.8-3.2 3-5.7 3.2-3.6.3-5.2 2.5-8.1 2.5-3.6 0-4.6-3.6-7-3.6C6.4 9.9 4.3 11 1 9.5Z" />
      <circle cx="26.4" cy="5.1" r=".9" fill="var(--background, #0a0a0b)" />
    </svg>
  );
}

/**
 * Thin thread along the top edge of the page that fills as you scroll. A small koi swims at its tip and
 * turns into a dragon once the "Why me" section (#why) has come into view. The fill is driven by a CSS
 * variable written in a requestAnimationFrame callback, so scrolling never triggers a React render.
 */
export function ScrollProgressKoi() {
  const ref = useRef<HTMLDivElement>(null);
  const [dragon, setDragon] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const flush = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio =
        max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      el.style.setProperty("--fx-progress", String(ratio));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(flush);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useEffect(() => {
    const target = document.getElementById("why");
    if (!target || typeof IntersectionObserver === "undefined") return;
    // "Reached" = in view now, or already scrolled past (it stays above the viewport).
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries)
        setDragon(entry.isIntersecting || entry.boundingClientRect.top < 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
      style={{ ["--fx-progress" as string]: 0 }}
    >
      <div
        className="h-full origin-left"
        style={{
          transform: "scaleX(var(--fx-progress))",
          background:
            "linear-gradient(90deg, #14b8a6, var(--role-accent, #f97316))",
        }}
      />
      <div
        className="absolute top-[3px] -translate-x-full"
        style={{
          left: "calc(var(--fx-progress) * 100%)",
          color: "var(--role-accent, #f97316)",
        }}
      >
        {dragon ? <DragonIcon /> : <KoiIcon />}
      </div>
    </div>
  );
}
