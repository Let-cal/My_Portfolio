"use client";

import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from "@/components/site/icons";
import { jumpFigure, stepFigure } from "@/lib/figures/nav";
import type { FigureView } from "@/lib/figures/view";
import {
  centerOn,
  clampView,
  containRect,
  fitScale,
  fitView,
  flipTransform,
  isZoomed,
  minimapRect,
  panBy,
  zoomAt,
  zoomTo,
  type Point,
  type Rect,
  type Size,
  type View,
} from "@/lib/figures/zoom";
import { cn } from "@/lib/utils";
import styles from "./viewer.module.css";

export type FigureViewerProps = {
  figures: FigureView[];
  /** The figure on screen, 0-based; the figures view behind follows it. */
  index: number;
  open: boolean;
  onIndexChange: (i: number) => void;
  /** Called once the close motion has finished. */
  onClose: () => void;
  /** The project title: the dialog is labelled "<title> - <caption>". */
  title: string;
  theme: "light" | "dark";
  /**
   * The stage of the figures view: the figure flies from it on open and back on close, and focus returns to it.
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
};

const FOCUS =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
/** Wheel: one notch (100 px, or 3 lines) zooms by 1.2. */
const NOTCH = 1.2;
/** A pan button or arrow key moves a fifth of the canvas. */
const PAN_STEP = 0.2;
const MINIMAP_W = 140;
const MINIMAP_H = 96;

/**
 * The - and + glyphs, drawn here rather than taken from the shared icon module: that module is in the initial
 * bundle, and every icon used anywhere is kept in it.
 */
function Glyph({ d }: { d: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d={d} />
    </svg>
  );
}

const toRect = (r: DOMRect): Rect => ({
  x: r.left,
  y: r.top,
  w: r.width,
  h: r.height,
});

/** Web Animations are there (not in jsdom). */
const canAnimate = (el: Element | null): el is HTMLElement =>
  !!el && typeof (el as HTMLElement).animate === "function";

/** The figure as the stage draws it (object-fit: contain), or null when the stage is not on screen. */
function stageFigureRect(
  stage: HTMLElement | null | undefined,
  content: Size,
): Rect | null {
  if (!stage) return null;
  const imgs = Array.from(stage.querySelectorAll("img")).filter(
    (img) => !img.closest("[data-figure-leaving]"),
  );
  const box = toRect((imgs.at(-1) ?? stage).getBoundingClientRect());
  if (box.w <= 0 || box.h <= 0) return null;
  return containRect(content, box);
}

/**
 * The Shoin full-screen figure viewer (spec 6.3): a second Radix dialog above the case study panel. Left, the index
 * of the figures grouped by category (a row of category chips under 1024 px); centre, the canvas with the figure
 * fitted on open; bottom, the caption, note, position and previous / next buttons.
 *
 * Zoom: wheel at the pointer, pinch (two pointers), double-click (fit and 100%), the - / + / Fit / 100% buttons and
 * the keys + - 0 1; from fit to 400%. Pan: drag (one pointer) when zoomed, the arrow keys when zoomed and four pan
 * buttons shown only then (the single-pointer alternative), and a click on the minimap. ArrowLeft / ArrowRight
 * change figure at fit; PageUp / PageDown always do. A new figure opens fitted.
 *
 * Motion (Web Animations): with full motion the figure flies from its place in the stage to the canvas (FLIP,
 * 320 ms) while the room fades in, and back in 240 ms on close (a fade instead when it is zoomed); reduced motion
 * fades only (150 ms). `onClose` runs after the close motion; focus then goes back to the stage.
 */
export function FigureViewer({
  figures,
  index,
  open,
  onIndexChange,
  onClose,
  title,
  theme,
  returnFocusRef,
}: FigureViewerProps) {
  const t = useTranslations("caseStudy");
  const tv = useTranslations("caseStudy.viewer");
  const count = figures.length;
  const at = Math.min(Math.max(index, 0), Math.max(count - 1, 0));
  const figure = figures[at];
  const content: Size = { w: figure.width, h: figure.height };
  const src = theme === "dark" && figure.srcDark ? figure.srcDark : figure.src;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const flipRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvas, setCanvas] = useState<HTMLDivElement | null>(null);

  // The canvas size, measured before paint and on every resize.
  const [box, setBox] = useState<Size>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!canvas) return;
    const measure = () => {
      const r = canvas.getBoundingClientRect();
      setBox((b) =>
        b.w === r.width && b.h === r.height ? b : { w: r.width, h: r.height },
      );
    };
    measure();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(canvas);
    return () => observer?.disconnect();
  }, [canvas]);

  // The view belongs to a figure: null (or another figure's) means fitted, so a new figure and a resize at fit
  // both show the whole figure.
  const [stored, setStored] = useState<{ id: string; view: View } | null>(null);
  const fit = fitScale(content, box);
  const view =
    stored?.id === figure.id
      ? clampView(stored.view, content, box, fit)
      : fitView(content, box);
  const zoomed = isZoomed(view, fit);

  // Pointer and wheel handlers run between renders: they read and write the latest view through this ref.
  const live = useRef({ view, content, box, fit, id: figure.id });
  useLayoutEffect(() => {
    live.current = { view, content, box, fit, id: figure.id };
  });
  const setView = (next: View | null) => {
    const l = live.current;
    if (next) live.current = { ...l, view: next };
    setStored(next ? { id: l.id, view: next } : null);
  };
  const center: Point = { x: box.w / 2, y: box.h / 2 };
  const zoomBy = (factor: number, point: Point = center) => {
    const l = live.current;
    setView(zoomAt(l.view, factor, point, l.content, l.box, l.fit));
  };
  const zoomToScale = (scale: number, point: Point = center) => {
    const l = live.current;
    setView(zoomTo(l.view, scale, point, l.content, l.box, l.fit));
  };
  const pan = (dx: number, dy: number) => {
    const l = live.current;
    setView(
      panBy(
        l.view,
        dx * PAN_STEP * l.box.w,
        dy * PAN_STEP * l.box.h,
        l.content,
        l.box,
        l.fit,
      ),
    );
  };
  // Double-click: back to fit when zoomed, otherwise 100% (twice the fit when the fit is already above 100%).
  const toggleZoom = (point: Point) => {
    if (isZoomed(live.current.view, live.current.fit)) setView(null);
    else zoomToScale(fit < 1 ? 1 : fit * 2, point);
  };

  const nav = { index: at, count };
  const go = (to: number) => {
    if (to !== at) onIndexChange(to);
  };

  // ---- motion: open (FLIP from the stage) and close (back to it) ----
  const closing = useRef(false);
  const opened = useRef(false);
  const running = useRef<Animation[]>([]);
  const stop = () => {
    for (const a of running.current) a.cancel();
    running.current = [];
  };
  useEffect(() => {
    if (open) closing.current = false;
    else opened.current = false;
  }, [open]);
  useEffect(() => stop, []);

  /** The FLIP transform that draws the fitted canvas figure where the stage draws it, or null. */
  const flipToStage = (): string | null => {
    const layer = flipRef.current;
    const target = stageFigureRect(returnFocusRef?.current, content);
    if (!layer || !target || box.w <= 0) return null;
    const origin = toRect(layer.getBoundingClientRect());
    const from: Rect = {
      x: origin.x + view.x,
      y: origin.y + view.y,
      w: content.w * view.scale,
      h: content.h * view.scale,
    };
    const f = flipTransform(from, target, origin);
    return `translate(${f.x}px, ${f.y}px) scale(${f.s})`;
  };

  // Runs once per open, in the commit where the content is mounted and measured: the Radix portal mounts the
  // content one commit after `open`, and a reopen measures the same box, so the canvas element is the key.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!open || opened.current || !canvas || box.w <= 0 || !canAnimate(root))
      return;
    opened.current = true;
    stop();
    const full = document.documentElement.dataset.motion === "full";
    const fade = (el: Element | null, duration: number) =>
      canAnimate(el)
        ? [
            el.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration,
              easing: "ease-out",
            }),
          ]
        : [];
    const flip = full ? flipToStage() : null;
    if (!flip) {
      running.current = [
        ...fade(root, full ? 320 : 150),
        ...fade(overlayRef.current, full ? 320 : 150),
      ];
      return;
    }
    running.current = [
      ...fade(overlayRef.current, 320),
      ...fade(surfaceRef.current, 320),
      ...Array.from(root.querySelectorAll("[data-chrome]")).flatMap((el) =>
        fade(el, 320),
      ),
      flipRef.current!.animate([{ transform: flip }, { transform: "none" }], {
        duration: 320,
        easing: EASE,
      }),
    ];
    // flipToStage reads the current view and box, which this effect is keyed on through `open`, `canvas` and `box`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canvas, box.w]);

  function requestClose() {
    if (closing.current) return;
    closing.current = true;
    stop();
    const root = rootRef.current;
    if (!canAnimate(root)) {
      onClose();
      return;
    }
    const full = document.documentElement.dataset.motion === "full";
    const out = (el: Element | null, duration: number) =>
      canAnimate(el)
        ? [
            el.animate([{ opacity: 1 }, { opacity: 0 }], {
              duration,
              easing: "ease-in",
              fill: "forwards",
            }),
          ]
        : [];
    const flip = full && !zoomed ? flipToStage() : null;
    const anims = flip
      ? [
          ...out(overlayRef.current, 240),
          ...out(surfaceRef.current, 240),
          ...Array.from(root.querySelectorAll("[data-chrome]")).flatMap((el) =>
            out(el, 240),
          ),
          flipRef.current!.animate(
            [{ transform: "none" }, { transform: flip }],
            { duration: 240, easing: EASE, fill: "forwards" },
          ),
        ]
      : [
          ...out(root, full ? 240 : 150),
          ...out(overlayRef.current, full ? 240 : 150),
        ];
    running.current = anims;
    Promise.all(anims.map((a) => a.finished)).then(
      () => {
        if (running.current === anims) onClose();
      },
      () => {
        // Cancelled (unmounted): nothing left to close.
      },
    );
  }

  // ---- input: keys, wheel, pointers ----
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const l = live.current;
    const isZoom = isZoomed(l.view, l.fit);
    const act: Record<string, () => void> = {
      "+": () => zoomBy(NOTCH),
      "=": () => zoomBy(NOTCH),
      "-": () => zoomBy(1 / NOTCH),
      _: () => zoomBy(1 / NOTCH),
      "0": () => setView(null),
      "1": () => zoomToScale(1),
      PageUp: () => go(stepFigure(nav, -1).index),
      PageDown: () => go(stepFigure(nav, 1).index),
      Home: () => go(jumpFigure(nav, "first").index),
      End: () => go(jumpFigure(nav, "last").index),
      ArrowLeft: () => (isZoom ? pan(1, 0) : go(stepFigure(nav, -1).index)),
      ArrowRight: () => (isZoom ? pan(-1, 0) : go(stepFigure(nav, 1).index)),
      ...(isZoom
        ? { ArrowUp: () => pan(0, 1), ArrowDown: () => pan(0, -1) }
        : {}),
    };
    const handler = act[event.key];
    if (!handler) return;
    // Handled here: the panel behind would move its own figure or project otherwise.
    event.preventDefault();
    event.stopPropagation();
    handler();
  }

  // The wheel listener must be able to cancel scrolling, so it is a native, non-passive one.
  useEffect(() => {
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 3 : event.deltaMode === 2 ? 1 : 100;
      const r = canvas.getBoundingClientRect();
      const l = live.current;
      const next = zoomAt(
        l.view,
        NOTCH ** (-event.deltaY / unit),
        { x: event.clientX - r.left, y: event.clientY - r.top },
        l.content,
        l.box,
        l.fit,
      );
      live.current = { ...l, view: next };
      setStored({ id: l.id, view: next });
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [canvas]);

  const pointers = useRef(new Map<number, Point>());
  const [dragging, setDragging] = useState(false);
  // Closed: the next open starts fitted, with no pointer left over from this one.
  if (!open && (stored !== null || dragging)) {
    setStored(null);
    setDragging(false);
  }
  useEffect(() => {
    if (!open) pointers.current.clear();
  }, [open]);
  const local = (event: { clientX: number; clientY: number }): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  };
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, local(event));
    setDragging(true);
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const map = pointers.current;
    const before = map.get(event.pointerId);
    if (!before) return;
    const now = local(event);
    const l = live.current;
    if (map.size === 1) {
      map.set(event.pointerId, now);
      if (isZoomed(l.view, l.fit))
        setView(
          panBy(
            l.view,
            now.x - before.x,
            now.y - before.y,
            l.content,
            l.box,
            l.fit,
          ),
        );
      return;
    }
    // Two pointers: pinch around their midpoint, and the midpoint's travel pans.
    const [a, b] = [...map.values()];
    const other = a === before ? b : a;
    map.set(event.pointerId, now);
    const dist = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);
    const mid = (p: Point, q: Point) => ({
      x: (p.x + q.x) / 2,
      y: (p.y + q.y) / 2,
    });
    const d0 = dist(before, other);
    if (d0 < 1) return;
    const m0 = mid(before, other);
    const m1 = mid(now, other);
    const zoomedView = zoomAt(
      l.view,
      dist(now, other) / d0,
      m0,
      l.content,
      l.box,
      l.fit,
    );
    setView(
      panBy(zoomedView, m1.x - m0.x, m1.y - m0.y, l.content, l.box, l.fit),
    );
  }
  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  }

  function onMinimapClick(event: MouseEvent<HTMLDivElement>) {
    const r = event.currentTarget.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const l = live.current;
    setView(
      centerOn(
        l.view,
        (event.clientX - r.left) / r.width,
        (event.clientY - r.top) / r.height,
        l.content,
        l.box,
        l.fit,
      ),
    );
  }

  // ---- image load state; Retry mounts a fresh <img> ----
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const loadKey = `${figure.id}|${src}|${attempt}`;

  // ---- index: categories in order of first appearance ----
  const groups: {
    category: FigureView["category"];
    kanji: string;
    items: number[];
  }[] = [];
  figures.forEach((f, i) => {
    const group = groups.find((g) => g.category === f.category);
    if (group) group.items.push(i);
    else groups.push({ category: f.category, kanji: f.kanji, items: [i] });
  });

  const mini = minimapRect(view, content, box);
  const miniW = Math.min(MINIMAP_W, (MINIMAP_H * content.w) / content.h);
  const pct = (n: number) => `${Math.round(n * 10000) / 100}%`;
  const atStart = at === 0;
  const atEnd = at === count - 1;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay ref={overlayRef} className={styles.overlay} />
        <DialogPrimitive.Content
          ref={rootRef}
          data-figure-viewer=""
          aria-modal="true"
          className={styles.viewer}
          onKeyDown={onKeyDown}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            canvasRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            const stage = returnFocusRef?.current;
            if (stage) {
              event.preventDefault();
              stage.focus();
            }
          }}
        >
          <div ref={surfaceRef} aria-hidden="true" className={styles.surface} />
          <DialogPrimitive.Title className="sr-only">
            {`${title} — ${figure.caption}`}
          </DialogPrimitive.Title>

          <nav aria-label={tv("index")} data-chrome="" className={styles.index}>
            <p className={styles.indexHead}>
              {title} · {tv("count", { count })}
            </p>
            <ul className={styles.groups}>
              {groups.map((g) => (
                <li key={g.category} className={styles.group}>
                  <button
                    type="button"
                    aria-current={g.items.includes(at) ? "true" : undefined}
                    onClick={() => go(g.items[0])}
                    className={cn(styles.category, FOCUS)}
                  >
                    <b aria-hidden="true" lang="ja">
                      {g.kanji}
                    </b>
                    {t(`categories.${g.category}`)} · {g.items.length}
                  </button>
                  <ol className={styles.items}>
                    {g.items.map((i) => (
                      <li key={figures[i].id}>
                        <button
                          type="button"
                          aria-current={i === at ? "true" : undefined}
                          onClick={() => go(i)}
                          className={cn(styles.item, FOCUS)}
                        >
                          {figures[i].caption}
                        </button>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
            <DialogPrimitive.Description className={styles.hint}>
              {tv("hint")}
            </DialogPrimitive.Description>
          </nav>

          <div className={styles.stageArea}>
            <div
              ref={(el) => {
                canvasRef.current = el;
                setCanvas(el);
              }}
              role="group"
              aria-label={tv("canvas")}
              tabIndex={0}
              data-canvas=""
              data-zoomed={zoomed ? "" : undefined}
              data-dragging={dragging ? "" : undefined}
              className={cn(styles.canvas, FOCUS)}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              onDoubleClick={(event) => toggleZoom(local(event))}
            >
              <div ref={flipRef} className={styles.flip}>
                <div
                  data-zoom-layer=""
                  className={styles.zoomLayer}
                  style={{
                    width: content.w,
                    height: content.h,
                    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                  }}
                >
                  {failed === loadKey ? null : (
                    // eslint-disable-next-line @next/next/no-img-element -- figure urls are admin-supplied and may be any host
                    <img
                      key={loadKey}
                      src={src}
                      alt={figure.alt}
                      width={figure.width}
                      height={figure.height}
                      draggable={false}
                      className={styles.figure}
                      onError={() => setFailed(loadKey)}
                    />
                  )}
                </div>
              </div>
              {failed === loadKey ? (
                <div className={styles.error}>
                  <p>{t("figureError")}</p>
                  <button
                    type="button"
                    onClick={() => setAttempt((a) => a + 1)}
                    onPointerDown={(event) => event.stopPropagation()}
                    className={cn(styles.retry, FOCUS)}
                  >
                    {t("retry")}
                  </button>
                </div>
              ) : null}
            </div>

            <div data-chrome="" className={styles.tools}>
              <button
                type="button"
                aria-label={tv("zoomOut")}
                aria-disabled={!zoomed || undefined}
                onClick={() => zoomBy(1 / NOTCH)}
                className={cn(styles.tool, styles.icon, FOCUS)}
              >
                <Glyph d="M5 12h14" />
              </button>
              <span data-testid="zoom-level" className={styles.level}>
                {Math.round(view.scale * 100)}%
              </span>
              <button
                type="button"
                aria-label={tv("zoomIn")}
                onClick={() => zoomBy(NOTCH)}
                className={cn(styles.tool, styles.icon, FOCUS)}
              >
                <Glyph d="M5 12h14M12 5v14" />
              </button>
              <button
                type="button"
                onClick={() => setView(null)}
                className={cn(styles.tool, FOCUS)}
              >
                {tv("fit")}
              </button>
              <button
                type="button"
                onClick={() => zoomToScale(1)}
                className={cn(styles.tool, FOCUS)}
              >
                <span className="sr-only">{tv("actualSize")} </span>
                100%
              </button>
              <button
                type="button"
                aria-label={tv("close")}
                onClick={requestClose}
                className={cn(styles.tool, styles.icon, styles.close, FOCUS)}
              >
                <XIcon aria-hidden="true" className="size-4" />
              </button>
            </div>

            {zoomed ? (
              <>
                <button
                  type="button"
                  aria-label={tv("panLeft")}
                  onClick={() => pan(1, 0)}
                  className={cn(styles.pan, styles.panLeft, FOCUS)}
                >
                  <ChevronLeftIcon aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={tv("panRight")}
                  onClick={() => pan(-1, 0)}
                  className={cn(styles.pan, styles.panRight, FOCUS)}
                >
                  <ChevronRightIcon aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={tv("panUp")}
                  onClick={() => pan(0, 1)}
                  className={cn(styles.pan, styles.panUp, FOCUS)}
                >
                  {/* The down chevron turned over: an up chevron would add an icon to the shared, initial icon module. */}
                  <ChevronDownIcon
                    aria-hidden="true"
                    className="size-4 rotate-180"
                  />
                </button>
                <button
                  type="button"
                  aria-label={tv("panDown")}
                  onClick={() => pan(0, -1)}
                  className={cn(styles.pan, styles.panDown, FOCUS)}
                >
                  <ChevronDownIcon aria-hidden="true" className="size-4" />
                </button>
                <div
                  aria-hidden="true"
                  data-minimap=""
                  className={styles.minimap}
                  style={{
                    width: miniW,
                    height: (miniW * content.h) / content.w,
                  }}
                  onClick={onMinimapClick}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- the same url as the canvas, already cached */}
                  <img src={src} alt="" className={styles.miniFigure} />
                  <span
                    data-minimap-view=""
                    className={styles.miniView}
                    style={{
                      left: pct(mini.x),
                      top: pct(mini.y),
                      width: pct(mini.w),
                      height: pct(mini.h),
                    }}
                  />
                </div>
              </>
            ) : null}
          </div>

          <footer data-chrome="" className={styles.foot}>
            <div className="min-w-0">
              <p className={styles.caption}>{figure.caption}</p>
              {figure.note ? (
                <p className={styles.note}>{figure.note}</p>
              ) : null}
            </div>
            <div className={styles.nav}>
              <button
                type="button"
                aria-label={t("prevFigure")}
                aria-disabled={atStart || undefined}
                onClick={() => go(stepFigure(nav, -1).index)}
                className={cn(styles.step, FOCUS)}
              >
                <ChevronLeftIcon aria-hidden="true" className="size-4" />
              </button>
              <span aria-hidden="true" className={styles.count}>
                {at + 1} / {count}
              </span>
              <button
                type="button"
                aria-label={t("nextFigure")}
                aria-disabled={atEnd || undefined}
                onClick={() => go(stepFigure(nav, 1).index)}
                className={cn(styles.step, FOCUS)}
              >
                <ChevronRightIcon aria-hidden="true" className="size-4" />
              </button>
            </div>
            <p className="sr-only" aria-live="polite">
              {`${t("figurePosition", { n: at + 1, count })}: ${figure.caption}`}
            </p>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
