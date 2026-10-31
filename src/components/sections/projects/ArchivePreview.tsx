"use client";

import { useEffect, useRef, useState } from "react";

const W = 220;
const H = 136;
const GAP = 16;
const LERP = 0.18;
/** Capture, so a scroll of any scroller under the row re-aims too. */
const VIEWPORT = { capture: true, passive: true } as const;

type Preview = { title: string; posterUrl: string | null };

/**
 * The archive's hover preview (spec 5.3): one fixed 220 × 136 card, `aria-hidden`, that follows the pointer over a
 * row (eased towards it in requestAnimationFrame) and shows the project's poster, else a gradient card with its
 * title. Keyboard focus on a row anchors it under the row's right edge. Decoration only: everything it shows is in
 * the row. The parent mounts it only for a fine pointer with motion allowed, after first paint.
 */
export function ArchivePreview({
  root,
  items,
}: {
  root: HTMLElement;
  items: Record<string, Preview>;
}) {
  const card = useRef<HTMLDivElement>(null);
  // The last project stays in the card while it fades out.
  const [state, setState] = useState<{ id: string | null; on: boolean }>({
    id: null,
    on: false,
  });
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const el = card.current;
    if (!el) return;
    let row: HTMLElement | null = null;
    let anchored = false;
    let shown = false;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let frame = 0;

    const rowOf = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>("[data-archive-kind]")
        : null;
    const place = () => {
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    };
    const tick = () => {
      frame = 0;
      if (anchored && row) aim(row);
      cx += (tx - cx) * LERP;
      cy += (ty - cy) * LERP;
      place();
      if (shown && (Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5))
        frame = requestAnimationFrame(tick);
    };
    const run = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    /** Under the row's right edge, or above it when there is no room below. */
    function aim(target: HTMLElement) {
      const box = target.getBoundingClientRect();
      tx = Math.max(GAP, box.right - W);
      ty =
        box.bottom + 8 + H <= window.innerHeight
          ? box.bottom + 8
          : box.top - 8 - H;
    }
    /** Beside the pointer: to its right, or its left near the right edge of the window. */
    function follow(x: number, y: number) {
      tx = x + GAP + W <= window.innerWidth ? x + GAP : x - GAP - W;
      ty = Math.min(Math.max(GAP, y - H / 2), window.innerHeight - H - GAP);
    }
    function show(next: HTMLElement, snap: boolean) {
      const key = next.id.replace(/^row-/, "");
      if (!itemsRef.current[key]) return;
      row = next;
      if (snap || !shown) {
        cx = tx;
        cy = ty;
        place();
      }
      shown = true;
      setState({ id: key, on: true });
      run();
    }
    /**
     * While anchored to a focused row, re-aim only when the page moves under it (no per-frame polling): a scroll, a
     * resize, or the rows' box changing size without either (a filter change, a late web font).
     */
    const onViewport = () => {
      if (anchored && row) run();
    };
    const layout =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(onViewport)
        : null;
    function anchor() {
      if (!anchored) {
        window.addEventListener("scroll", onViewport, VIEWPORT);
        window.addEventListener("resize", onViewport, VIEWPORT);
        layout?.observe(root);
      }
      anchored = true;
    }
    function unanchor() {
      if (anchored) {
        window.removeEventListener("scroll", onViewport, VIEWPORT);
        window.removeEventListener("resize", onViewport, VIEWPORT);
        layout?.disconnect();
      }
      anchored = false;
    }
    function hide() {
      row = null;
      unanchor();
      shown = false;
      setState((now) => (now.on ? { ...now, on: false } : now));
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = rowOf(event.target);
      if (!target) return;
      unanchor();
      follow(event.clientX, event.clientY);
      if (target !== row) show(target, false);
      run();
    };
    const onLeave = (event: PointerEvent) => {
      if (anchored || !row) return;
      if (rowOf(event.relatedTarget) !== row) hide();
    };
    const onFocus = (event: FocusEvent) => {
      const target = rowOf(event.target);
      if (!target || !(event.target as Element).matches?.(":focus-visible"))
        return;
      anchor();
      aim(target);
      show(target, true);
    };
    const onBlur = (event: FocusEvent) => {
      if (anchored && rowOf(event.relatedTarget) !== row) hide();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && shown) hide();
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerout", onLeave);
    root.addEventListener("pointerdown", hide);
    root.addEventListener("focusin", onFocus);
    root.addEventListener("focusout", onBlur);
    root.addEventListener("keydown", onKey);
    // Opening a case study (Enter or a click) covers the page: the card goes with the row.
    root.addEventListener("click", hide);
    return () => {
      cancelAnimationFrame(frame);
      unanchor();
      layout?.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerout", onLeave);
      root.removeEventListener("pointerdown", hide);
      root.removeEventListener("focusin", onFocus);
      root.removeEventListener("focusout", onBlur);
      root.removeEventListener("keydown", onKey);
      root.removeEventListener("click", hide);
    };
  }, [root]);

  const item = state.id ? items[state.id] : null;
  return (
    <div
      ref={card}
      aria-hidden="true"
      data-archive-preview=""
      data-on={state.on && item ? "" : undefined}
      className="pa-preview"
    >
      {item?.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- poster URLs are admin-supplied and may be any host
        <img src={item.posterUrl} alt="" className="pa-preview-img" />
      ) : (
        <span className="pa-preview-title">{item?.title}</span>
      )}
    </div>
  );
}
