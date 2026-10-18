"use client";

import { useEffect, type RefObject } from "react";

/** Attach geometry-dependent work on approach, keeping SSR markup and native layout untouched. */
export function useNearViewportEffect(ref: RefObject<HTMLElement | null>, setup: () => void | VoidFunction, contentKey?: number | string) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let disposed = false, started = false;
    let observer: IntersectionObserver | undefined;
    let stop: VoidFunction | undefined;
    const removeListeners = () => {
      element.removeEventListener("focusin", start);
      element.removeEventListener("pointerdown", start, true);
    };
    const start = () => {
      if (disposed || started) return;
      started = true;
      observer?.disconnect();
      removeListeners();
      const cleanup = setup();
      if (typeof cleanup === "function") stop = cleanup;
    };
    // Keyboard focus or a first drag can arrive before IO has delivered its first notification.
    element.addEventListener("focusin", start);
    element.addEventListener("pointerdown", start, true);
    if (typeof IntersectionObserver === "undefined") start();
    else {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) start();
      }, { rootMargin: "600px" });
      observer.observe(element);
    }
    return () => {
      disposed = true;
      observer?.disconnect();
      removeListeners();
      stop?.();
    };
  }, [ref, setup, contentKey]);
}
