"use client";

import { useEffect } from "react";
import { SECTION_IDS } from "@/components/site/sections";
import { getChapterProgress } from "./chapters";
import { mergeRects, selectRects, type Rect } from "./environment/legibility";
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
    // The pointer left the page or the window lost focus: nothing is hovering the water any more.
    const onLeave = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      next = null;
      sceneStore.setState({ pointer: null });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      sceneStore.setState({ pointer: null });
    };
  }, [enabled]);
}

/** Pixels around a block of text over which the veil fades; rectangles this far off screen can be ignored. */
const AVOID_MARGIN = 120;
/** Blocks closer than this (px) are protected as one: a row of skill chips, the lines of a list. */
const MERGE_GAP = 28;

function sameRects(a: Rect[], b: Rect[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].x0 !== b[i].x0 || a[i].y0 !== b[i].y0 || a[i].x1 !== b[i].x1 || a[i].y1 !== b[i].y1) return false;
  }
  return true;
}

/**
 * What the water and the creature must leave readable: anything marked `data-scene-avoid`, the glass surfaces (cards,
 * the header pill, the nav pill: everything with a `backdrop-blur` utility, which are translucent, so whatever swims
 * behind them shows through their text), and the text of the page itself (headings, paragraphs, list items, links and
 * buttons in `main`). A block of text that sits straight on the backdrop is covered without anyone having to remember it.
 */
const AVOID_SELECTOR =
  '[data-scene-avoid], [class*="backdrop-blur"], main :is(h1, h2, h3, h4, p, dt, dd, li, summary, label, button, a)';

const range = typeof document === "undefined" ? null : document.createRange();

/**
 * Viewport rectangle to protect for an element: the whole box of a glass surface (or `data-scene-avoid="box"`), else
 * the tight box around the lines of its text (not the, often much wider, block it sits in).
 */
function protectedRect(el: Element, box: DOMRect): DOMRect {
  const mark = el.getAttribute("data-scene-avoid");
  const glass = mark === "box" || (mark === null && (el.getAttribute("class") ?? "").includes("backdrop-blur"));
  if (!range || glass) return box;
  range.selectNodeContents(el);
  const r = range.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r : box;
}

/** WCAG large text: 24px and up, or 18.66px and up in bold. Only the lines of a text block count (glass cards mix sizes). */
function isLargeText(el: Element): boolean {
  const mark = el.getAttribute("data-scene-avoid");
  if (mark === "box" || (mark === null && (el.getAttribute("class") ?? "").includes("backdrop-blur"))) return false;
  const cs = getComputedStyle(el);
  const size = parseFloat(cs.fontSize);
  return size >= 24 || (size >= 18.66 && (parseInt(cs.fontWeight, 10) || 400) >= 700);
}

/** Elements pinned to the screen (fixed or sticky) do not move with the page: their position is never stale. */
const PINNED_SELECTOR = '[class*="fixed"], [class*="sticky"]';

/**
 * Finds the elements worth protecting and measures the ones near the screen. `refresh` is the full pass (every
 * candidate and where it sits on the page: about a millisecond for a page this size); `measure` is the cheap one for
 * each scroll frame: it only reads the rectangles of the candidates near the viewport, plus the pinned ones.
 */
export function createAvoidMeter() {
  let items: { el: Element; top: number; bottom: number; pinned: boolean }[] = [];
  return {
    refresh() {
      const sy = window.scrollY;
      items = [];
      for (const el of document.querySelectorAll(AVOID_SELECTOR)) {
        const b = el.getBoundingClientRect();
        if (b.width <= 0 || b.height <= 0) continue;
        items.push({ el, top: b.top + sy, bottom: b.bottom + sy, pinned: !!el.closest(PINNED_SELECTOR) });
      }
    },
    /** The screen-space rectangles near the viewport (see `selectRects`, `mergeRects`). */
    measure(): Rect[] {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const sy = window.scrollY;
      const found: Rect[] = [];
      for (const it of items) {
        if (!it.pinned && (it.bottom - sy < -AVOID_MARGIN || it.top - sy > h + AVOID_MARGIN)) continue;
        const box = it.el.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) continue;
        if (box.bottom < -AVOID_MARGIN || box.top > h + AVOID_MARGIN) continue;
        const r = protectedRect(it.el, box);
        // Visually hidden text (screen-reader-only labels) is a pixel or two wide: nothing to protect.
        if (r.width < 6 || r.height < 6) continue;
        found.push({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, large: isLargeText(it.el) });
      }
      return selectRects(mergeRects(found, MERGE_GAP), w, h);
    },
  };
}

/** A full pass and a measure in one go (tests, and anything that does not run every frame). */
export function measureAvoid(): Rect[] {
  const meter = createAvoidMeter();
  meter.refresh();
  return meter.measure();
}

/**
 * Keeps `avoid` in the scene store up to date: the blocks of text and glass surfaces that the water and the creature
 * must leave readable. A scroll frame only re-reads what is near the screen; a full pass follows resizes, layout
 * changes, transitions, clicks and the end of a scroll. Nothing is written when no rectangle moved. No React state.
 */
export function useAvoidTracking(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const meter = createAvoidMeter();
    let dirty = true;
    let frame = 0;
    let clickTimer = 0;
    let idleTimer = 0;
    const flush = () => {
      frame = 0;
      if (dirty) {
        dirty = false;
        meter.refresh();
      }
      const next = meter.measure();
      if (!sameRects(next, sceneStore.getState().avoid)) sceneStore.setState({ avoid: next });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const relayout = () => {
      dirty = true;
      schedule();
    };
    const onScroll = () => {
      schedule();
      // When the scroll stops, check the page did not shift under the cached positions (late images, fonts).
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(relayout, 250);
    };
    // A click can open or close something; look again once its transition has had time to settle.
    const afterClick = () => {
      window.clearTimeout(clickTimer);
      clickTimer = window.setTimeout(relayout, 400);
    };
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(relayout);
    resizeObserver?.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", relayout);
    window.addEventListener("load", relayout);
    document.addEventListener("transitionend", relayout, true);
    document.addEventListener("animationend", relayout, true);
    document.addEventListener("click", afterClick, true);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(clickTimer);
      window.clearTimeout(idleTimer);
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", relayout);
      window.removeEventListener("load", relayout);
      document.removeEventListener("transitionend", relayout, true);
      document.removeEventListener("animationend", relayout, true);
      document.removeEventListener("click", afterClick, true);
      sceneStore.setState({ avoid: [] });
    };
  }, [enabled]);
}

/** Things a click on the water must leave alone: they have a job of their own. */
const NOT_WATER = 'a, button, input, select, textarea, label, summary, [role="radio"], [role="button"], [role="tab"], [data-role-wheel], [data-panel], [data-no-feed]';

let dropCount = 0;

/**
 * Turns a click on a `[data-water-zone]` (the empty water behind the hero wheel) into a drop request in the store.
 * The canvas ignores pointer events and the zone is only a layout box, so this reads the click from the window and
 * tests it against the zones' rectangles; links, buttons and the role wheel keep their own clicks. The scene raycasts
 * the request onto the water and adds the food (see `Feeding`).
 */
export function useFeedClicks(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(NOT_WATER)) return;
      const inZone = [...document.querySelectorAll("[data-water-zone]")].some((el) => {
        const r = el.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      });
      if (!inZone) return;
      sceneStore.setState({
        drop: {
          x: (e.clientX / window.innerWidth) * 2 - 1,
          y: -((e.clientY / window.innerHeight) * 2 - 1),
          id: ++dropCount,
        },
      });
    };
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("click", onClick);
      sceneStore.setState({ drop: null });
    };
  }, [enabled]);
}
