import type Lenis from "lenis";
import { getMotionReduced } from "./motion-preference";

/** The running Lenis instance (null while smooth scroll is off), shared between SmoothScroll and the command palette. */
let current: Lenis | null = null;

export function setLenis(instance: Lenis | null) {
  current = instance;
}

export function getLenis(): Lenis | null {
  return current;
}

/** Content above the target can change height while the scroll runs (fonts, images); correct a miss once, quickly. */
function settle(el: HTMLElement) {
  const margin =
    Number.parseFloat(window.getComputedStyle(el).scrollMarginTop) || 0;
  if (Math.abs(el.getBoundingClientRect().top - margin) > 2)
    current?.scrollTo(el, { duration: 0.4 });
}

/**
 * Scrolls `el` to the top of the viewport, below the header: through Lenis while smooth scroll is active,
 * otherwise with the browser (`smooth` unless the page is in reduced motion). Both honour the element's
 * `scroll-margin-top` (the sections use `scroll-mt-14` to clear the fixed header).
 */
export function scrollToElement(el: HTMLElement) {
  if (current) {
    current.scrollTo(el, { onComplete: () => settle(el) });
    return;
  }
  el.scrollIntoView({
    behavior: getMotionReduced() ? "auto" : "smooth",
    block: "start",
  });
}
