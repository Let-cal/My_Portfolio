"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Arms an element for a reveal-on-scroll and tells when it has come into view.
 *
 * - `armed`: the element was measured off-screen, so it should start hidden (or held) and wait.
 * - `shown`: it has been seen. Once true it stays true; the observer is released.
 *
 * Until the observer reports (server render, first paint, no IntersectionObserver, no JS) both flags are
 * false and the element should simply be visible: content is never hidden by a script that did not run.
 * Reduced motion is handled in CSS, which forces the final state whatever these flags say.
 */
export function useRevealOnView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [state, setState] = useState({ armed: false, shown: false });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        setState((prev) => {
          if (prev.shown) return prev;
          return visible
            ? { armed: prev.armed, shown: true }
            : { armed: true, shown: false };
        });
        if (visible) io.disconnect();
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, ...state };
}
