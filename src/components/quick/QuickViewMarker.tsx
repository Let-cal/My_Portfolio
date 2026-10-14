"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Keeps `data-quick-view` on the quick view's `<main>` only while the page is really shown. After a soft
 * navigation away, React can keep the page in the DOM as a hidden copy (its effects are cleaned up); the attribute
 * goes with the cleanup, so globals.css (`body:has([data-quick-view])`) brings the site chrome back. The server
 * HTML carries the attribute, so the chrome is hidden before any script runs.
 *
 * This replaces a `:not([style*="display: none"])` test inside that `:has()`: a `:has()` that looks at the `style`
 * attribute makes every inline style change anywhere on the page restyle the whole body.
 */
export function QuickViewMarker() {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const root = ref.current?.closest("main");
    if (!root) return;
    root.setAttribute("data-quick-view", "");
    return () => root.removeAttribute("data-quick-view");
  }, []);
  return <span ref={ref} hidden />;
}
