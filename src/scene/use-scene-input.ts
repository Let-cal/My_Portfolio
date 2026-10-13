"use client";

import { useEffect } from "react";
import { SECTION_IDS } from "@/components/site/sections";
import { getChapterProgress } from "./chapters";
import { sceneStore } from "./store";

/** Document-space top of every section, in `SECTION_IDS` order. A missing section never becomes the chapter. */
function measureTops(): number[] {
  return SECTION_IDS.map((id) => {
    const el = document.getElementById(id);
    return el ? el.getBoundingClientRect().top + window.scrollY : Number.POSITIVE_INFINITY;
  });
}

/**
 * Writes `{ chapter, t }` into the scene store as the page scrolls. Lenis drives native scroll, so plain
 * scroll events are enough. Everything runs in requestAnimationFrame callbacks and only the store's
 * subscribers hear about it: no React state, no page re-render.
 */
export function useChapterTracking() {
  useEffect(() => {
    let tops = measureTops();
    let frame = 0;
    const flush = () => {
      frame = 0;
      const { chapter, t } = getChapterProgress(window.scrollY, tops, window.innerHeight);
      sceneStore.setState({ chapter, t });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const remeasure = () => {
      tops = measureTops();
      schedule();
    };
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(remeasure);
    resizeObserver?.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", remeasure);
    // Fonts and images that finish late move the sections.
    window.addEventListener("load", remeasure);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("load", remeasure);
    };
  }, []);
}

/**
 * Pointer position (normalised, -1..1, y up) goes into the store only while the cursor is over a
 * `[data-water-zone]` or the hero is the current chapter; anywhere else it is reset to null. One write per frame.
 */
export function usePointerTracking(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    let next: { x: number; y: number } | null = null;
    const flush = () => {
      frame = 0;
      sceneStore.setState({ pointer: next });
    };
    const onMove = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const over = !!target?.closest("[data-water-zone]") || sceneStore.getState().chapter === 0;
      next = over ? { x: (e.clientX / window.innerWidth) * 2 - 1, y: -((e.clientY / window.innerHeight) * 2 - 1) } : null;
      if (!frame) frame = requestAnimationFrame(flush);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      sceneStore.setState({ pointer: null });
    };
  }, [enabled]);
}
