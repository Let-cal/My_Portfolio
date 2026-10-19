"use client";

import { useEffect, type RefObject } from "react";

/** Keep the complete native DOM visible; attach the existing Motion scroll engine near the viewport. */
export function useScrollEnhancement(
  ref: RefObject<HTMLElement | null>,
  kind: "beam" | "words",
  reduced: boolean,
  contentKey = "",
) {
  useEffect(() => {
    const element = ref.current;
    if (!element || reduced) return;
    let cancelled = false;
    let started = false;
    let stop: VoidFunction | undefined;
    const start = () => {
      if (started || cancelled) return;
      started = true;
      observer?.disconnect();
      void import("./scroll-enhancements")
        .then((module) => {
          if (!cancelled)
            stop =
              kind === "beam"
                ? module.attachBeam(element)
                : module.attachWords(element);
        })
        .catch(() => {
          // A failed decorative chunk must leave readable content on screen.
          if (!cancelled)
            element
              .querySelectorAll<HTMLElement>("[data-reveal-unit]")
              .forEach((word) => {
                word.style.opacity = "1";
              });
        });
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? undefined
        : new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) start();
            },
            { rootMargin: "600px" },
          );
    if (observer) observer.observe(element);
    else start();
    return () => {
      cancelled = true;
      observer?.disconnect();
      stop?.();
    };
  }, [ref, kind, reduced, contentKey]);
}
