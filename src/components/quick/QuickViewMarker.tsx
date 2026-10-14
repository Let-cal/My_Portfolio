"use client";

import { useLayoutEffect, useRef } from "react";
import { QUICK_HTML_ATTR } from "./quick-mark";

/**
 * Marks `<html data-quick>` and the view's `<main data-quick-view>` only while the page is really shown. After a soft
 * navigation away, React can keep the page in the DOM as a hidden copy (its effects are cleaned up); both marks go
 * with the cleanup, so the site chrome of the page you came back to stays.
 *
 * The chrome rule in globals.css keys on <html> instead of `body:has([data-quick-view])`: a `:has()` on <body>
 * makes Chrome restyle the whole page on DOM insertions (and, with a [style] test, on every inline style change).
 */
export function QuickViewMarker() {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const root = ref.current?.closest("main");
    const html = document.documentElement;
    html.setAttribute(QUICK_HTML_ATTR, "");
    root?.setAttribute("data-quick-view", "");
    return () => {
      html.removeAttribute(QUICK_HTML_ATTR);
      root?.removeAttribute("data-quick-view");
    };
  }, []);
  return <span ref={ref} hidden />;
}
