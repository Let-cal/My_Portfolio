"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/site/icons";
import * as motion from "motion/react-m";
import { useDragControls, useMotionValue } from "motion/react";
import { flushSync } from "react-dom";
import type { animate } from "motion";
import { loadAnimate } from "@/lib/load-animate";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";
import { useNearViewportEffect } from "@/components/fx/use-near-viewport-effect";
import { cn } from "@/lib/utils";

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/** The track positions at which each card is centred in the viewport, clamped so the track never shows empty space. */
type Metrics = { stops: number[]; min: number };
const EMPTY: Metrics = { stops: [], min: 0 };

const ROUND_BUTTON =
  "inline-flex size-[50px] shrink-0 items-center justify-center rounded-full border border-(--role-accent) bg-(--role-accent)/10 text-(--role-accent-text) shadow-[0_2px_10px_color-mix(in_srgb,var(--role-accent)_15%,transparent)] transition-[background-color,color,transform,box-shadow,opacity] duration-300 ease-out hover:scale-105 hover:bg-(--role-accent) hover:text-(--role-accent-contrast) active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:scale-100 aria-disabled:hover:bg-(--role-accent)/10 aria-disabled:hover:text-(--role-accent-text) motion-reduce:transition-none";

/**
 * Draggable Why Hire Me carousel. The track is a motion `drag="x"` element with momentum; on release the inertia is
 * steered to the nearest card (snap), which becomes the active card. The prev/next buttons, the dots and the arrow
 * keys (while the carousel region has focus) all move the active card by animating the same motion value. The
 * current card is announced politely ("2 of 4"). Reduced motion keeps dragging but snaps without animation.
 */
export function WhyCarousel({
  cards,
}: {
  cards: { id: string; content: ReactNode }[];
}) {
  const t = useTranslations("why");
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY);
  const [dragReady, setDragReady] = useState(false);
  const dragControls = useDragControls();
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const moved = useRef(false);
  const total = cards.length;

  // Measure where each card sits. Re-measured when the viewport or the track changes size (resize, locale, fonts).
  const setupMeasurements = useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    setDragReady(true);
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const width = viewport.clientWidth;
      const min = -Math.max(0, track.scrollWidth - width);
      const stops = Array.from(track.children, (child) => {
        const el = child as HTMLElement;
        return clamp(width / 2 - (el.offsetLeft + el.offsetWidth / 2), min, 0);
      });
      setMetrics((prev) =>
        prev.min === min &&
        prev.stops.length === stops.length &&
        prev.stops.every((s, i) => s === stops[i])
          ? prev
          : { stops, min },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      document.fonts?.addEventListener("loadingdone", measure);
      return () => {
        disposed = true;
        window.removeEventListener("resize", measure);
        document.fonts?.removeEventListener("loadingdone", measure);
      };
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(track);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, []);
  useNearViewportEffect(rootRef, setupMeasurements, total);

  // Move the track to the active card (buttons, keys, dots, focus). A drag that already ended there needs no move.
  useEffect(() => {
    const target = metrics.stops[active];
    if (target === undefined || Math.abs(x.get() - target) < 0.5) return;
    if (reduced) {
      x.set(target);
      return;
    }
    let cancelled = false;
    let controls: ReturnType<typeof animate> | undefined;
    void loadAnimate()
      .then((animate) => {
        if (!cancelled)
          controls = animate(x, target, {
            type: "spring",
            stiffness: 240,
            damping: 30,
            mass: 0.9,
          });
      })
      .catch(() => {
        if (!cancelled) x.set(target);
      });
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [active, metrics, reduced, x]);

  /** Index of the card the track currently sits on; the ends win so a drag to either end selects the first/last card. */
  const indexAt = useCallback(
    (position: number) => {
      const { stops, min } = metrics;
      if (stops.length === 0) return 0;
      if (position >= -0.5) return 0;
      if (position <= min + 0.5) return stops.length - 1;
      let best = 0;
      stops.forEach((stop, i) => {
        if (Math.abs(stop - position) < Math.abs(stops[best] - position))
          best = i;
      });
      return best;
    },
    [metrics],
  );

  const go = useCallback(
    (index: number) => setActive(clamp(index, 0, total - 1)),
    [total],
  );

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") go(active + 1);
    else if (e.key === "ArrowLeft") go(active - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(total - 1);
    else return;
    e.preventDefault();
  }

  // A drag must not follow through into a click on a link under the pointer.
  function swallowClickAfterDrag(e: MouseEvent) {
    if (!moved.current) return;
    e.preventDefault();
    e.stopPropagation();
  }

  const atStart = active === 0;
  const atEnd = active === total - 1;
  const status = t("slideStatus", { current: active + 1, total });

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    // A first gesture can precede IO. Subscribe controls before handing them the same event.
    if (!dragReady) flushSync(() => setDragReady(true));
    dragControls.start(event);
  }

  return (
    <div
      ref={rootRef}
      className="relative mt-12 -mx-4 sm:-mx-6 lg:mx-0 lg:px-[60px]"
    >
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={t("carouselLabel")}
        aria-describedby="why-hint"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="rounded-xl outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <div
          ref={viewportRef}
          className="overflow-x-clip pt-6 pb-12 [mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-16px),transparent)]"
        >
          <motion.div
            ref={trackRef}
            data-carousel-track=""
            className="relative flex w-max cursor-grab gap-6 px-4 active:cursor-grabbing sm:px-6 lg:px-3"
            style={{
              x,
              touchAction: "pan-y",
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            }}
            drag={dragReady ? "x" : false}
            layout="position"
            layoutDependency={metrics}
            dragControls={dragReady ? dragControls : undefined}
            dragListener={false}
            onPointerDown={startDrag}
            dragConstraints={{ left: metrics.min, right: 0 }}
            dragElastic={0.14}
            dragMomentum={!reduced}
            dragTransition={{
              power: 0.4,
              timeConstant: 240,
              bounceStiffness: 420,
              bounceDamping: 40,
              modifyTarget: (target) => {
                const stops = metrics.stops;
                if (stops.length === 0) return target;
                return stops[indexAt(clamp(target, metrics.min, 0))];
              },
            }}
            onDragStart={() => {
              moved.current = false;
            }}
            onDrag={(_, info) => {
              if (Math.abs(info.offset.x) > 6) moved.current = true;
            }}
            onDragEnd={() => {
              // Without momentum (reduced motion) there is no inertia to end the drag: snap right away.
              if (reduced) setActive(indexAt(x.get()));
              setTimeout(() => {
                moved.current = false;
              }, 0);
            }}
            onDragTransitionEnd={() => setActive(indexAt(x.get()))}
            onClickCapture={swallowClickAfterDrag}
            onDragStartCapture={(e) => e.preventDefault()}
          >
            {cards.map((card, i) => (
              <div
                key={card.id}
                role="group"
                aria-roledescription="slide"
                aria-label={t("slideStatus", { current: i + 1, total })}
                data-active={i === active ? "true" : undefined}
                onFocusCapture={() => setActive(i)}
                className={cn(
                  "why-slide shrink-0 origin-center transition-transform duration-500 ease-out motion-reduce:transition-none",
                  i === active ? "scale-100" : "scale-[0.96] saturate-[0.85]",
                )}
              >
                {card.content}
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <p id="why-hint" className="sr-only">
        {t("hint")}
      </p>

      <div className="mt-2 flex items-center justify-center gap-5">
        <button
          type="button"
          aria-label={t("prev")}
          aria-disabled={atStart}
          onClick={() => go(active - 1)}
          className={cn(ROUND_BUTTON, "lg:absolute lg:top-[249px] lg:left-0")}
        >
          <ChevronLeftIcon aria-hidden="true" className="size-6" />
        </button>

        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center">
            {cards.map((card, i) => (
              <button
                key={card.id}
                type="button"
                aria-label={t("goTo", { n: i + 1 })}
                aria-current={i === active ? "true" : undefined}
                onClick={() => go(i)}
                className="group flex size-6 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-2 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none",
                    i === active
                      ? "w-6 bg-(--role-accent)"
                      : "w-2 bg-foreground/30 group-hover:bg-foreground/55",
                  )}
                />
              </button>
            ))}
          </div>
          <p
            role="status"
            aria-live="polite"
            className="font-mono text-xs tracking-wider text-muted-foreground tabular-nums"
          >
            {status}
          </p>
        </div>

        <button
          type="button"
          aria-label={t("next")}
          aria-disabled={atEnd}
          onClick={() => go(active + 1)}
          className={cn(ROUND_BUTTON, "lg:absolute lg:top-[249px] lg:right-0")}
        >
          <ChevronRightIcon aria-hidden="true" className="size-6" />
        </button>
      </div>
    </div>
  );
}
