"use client";

import { useEffect } from "react";
import {
  useMediaQuery,
  usePrefersReducedMotion,
} from "@/components/fx/use-media-query";
import { MOBILE_QUERY } from "@/scene/tier";
import { getMotionReduced } from "./motion-preference";
import { scrollToElement, setLenis } from "./lenis-instance";

/** An in-page link (`#section` on this page) that a plain left click should smooth-scroll to; otherwise null. */
function anchorTarget(
  event: MouseEvent,
): { el: HTMLElement; hash: string } | null {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return null;
  const link = (event.target as Element | null)?.closest?.(
    "a[href]",
  ) as HTMLAnchorElement | null;
  if (
    !link ||
    (link.target && link.target !== "_self") ||
    link.hasAttribute("download")
  )
    return null;
  const url = new URL(link.href, window.location.href);
  if (
    url.origin !== window.location.origin ||
    url.pathname !== window.location.pathname ||
    url.hash.length < 2
  )
    return null;
  let id = url.hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    // A malformed escape such as "#%E0%A4%A": look the raw text up instead of throwing out of the click handler.
  }
  const el = document.getElementById(id);
  return el ? { el, hash: url.hash } : null;
}

/**
 * Lenis smooth scrolling, driven by `gsap.ticker` and feeding `ScrollTrigger.update`. It follows the effective
 * reduced-motion preference live (the Motion toggle wins over the OS): while the page is in reduced motion Lenis
 * is not created, and flipping the toggle creates or destroys it without a reload. Lenis keeps the native scroller,
 * so `position: sticky` and `motion`'s `useScroll` keep working. In-page `#section` links go through Lenis,
 * which honours the section's `scroll-margin-top` (the header height), and update the URL hash.
 */
export function SmoothScroll() {
  const reduced = usePrefersReducedMotion();
  const isMobile = useMediaQuery(MOBILE_QUERY);

  useEffect(() => {
    // Resolve all intrinsic placeholders before the browser computes a native hash jump.
    // Capture runs before section-link handlers; it never cancels the native navigation.
    const prepare = (event: MouseEvent) => {
      if (window.matchMedia?.(MOBILE_QUERY).matches && anchorTarget(event)) {
        document.documentElement.setAttribute("data-chapters-expanded", "");
      }
    };
    document.addEventListener("click", prepare, true);
    return () => document.removeEventListener("click", prepare, true);
  }, []);

  useEffect(() => {
    // Hydration first uses the SSR media snapshot; read the browser before starting any imports.
    const mobileNow =
      typeof window.matchMedia === "function" &&
      window.matchMedia(MOBILE_QUERY).matches;
    if (reduced || isMobile || mobileNow || getMotionReduced()) return;
    // gsap, ScrollTrigger and Lenis load after hydration so they stay out of the first page load.
    let cancelled = false;
    let teardown: (() => void) | undefined;

    void Promise.all([
      import("lenis"),
      import("gsap"),
      import("gsap/ScrollTrigger"),
    ]).then(([{ default: Lenis }, { default: gsap }, { ScrollTrigger }]) => {
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      // allowNestedScroll: scrollable panels (skill evidence, case-study sheet) keep their own wheel scrolling.
      // respectReducedMotion off: this component already decides, and the Motion toggle must be able to override the OS.
      const lenis = new Lenis({
        autoRaf: false,
        allowNestedScroll: true,
        respectReducedMotion: false,
      });
      lenis.on("scroll", ScrollTrigger.update);
      // gsap.ticker passes seconds; Lenis wants milliseconds.
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      setLenis(lenis);

      const onClick = (event: MouseEvent) => {
        const target = anchorTarget(event);
        if (!target) return;
        event.preventDefault();
        scrollToElement(target.el);
        window.history.pushState(null, "", target.hash);
      };
      document.addEventListener("click", onClick);

      teardown = () => {
        document.removeEventListener("click", onClick);
        gsap.ticker.remove(tick);
        setLenis(null);
        lenis.destroy();
      };
    });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [reduced, isMobile]);

  return null;
}
