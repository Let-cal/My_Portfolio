"use client";

import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Maximize2Icon,
} from "@/components/site/icons";
import { jumpFigure, stepFigure, type FigureNav } from "@/lib/figures/nav";
import type { FigureView } from "@/lib/figures/view";
import { cn } from "@/lib/utils";
import styles from "./figures.module.css";

export type FigureScrollProps = {
  figures: FigureView[];
  /** The current figure, 0-based. */
  index: number;
  onIndexChange: (i: number) => void;
  /** Opens the full-screen viewer on figure `i`. */
  onEnlarge: (i: number) => void;
  theme: "light" | "dark";
};

const FOCUS =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** The rendering that matches the site theme. Only this url is ever put in a `src`, so the other is never fetched. */
export function figureSrc(figure: FigureView, theme: "light" | "dark") {
  return theme === "dark" && figure.srcDark ? figure.srcDark : figure.src;
}

/** Web Animations are there (not in jsdom or very old browsers): figure changes can cross-fade. */
const canAnimate = () =>
  typeof HTMLElement !== "undefined" &&
  typeof HTMLElement.prototype.animate === "function";

type Leaving = { index: number; dir: 1 | -1; n: number };
type Load = { key: string; state: "loaded" | "error" };

/**
 * The figures view of the case study panel (spec 6.2): the stage with the current figure, its category seal, the
 * Enlarge and previous / next buttons, the caption and note, and the filmstrip (a tablist, one tab per figure,
 * roving tabindex) with the position label. Arrow keys, Home and End anywhere inside move between figures; Enter
 * on the stage, the Enlarge button or a click on the figure call `onEnlarge`. A figure change cross-fades with the
 * Web Animations API (full motion: the old figure also drifts 12 px against the direction of travel); a new press
 * cancels the running transition instead of queueing it.
 */
export function FigureScroll({
  figures,
  index,
  onIndexChange,
  onEnlarge,
  theme,
}: FigureScrollProps) {
  const t = useTranslations("caseStudy");
  const uid = useId();
  const count = figures.length;
  const current = figures[Math.min(index, count - 1)];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const leavingRef = useRef<HTMLDivElement | null>(null);
  const currentRef = useRef<HTMLDivElement | null>(null);
  const running = useRef<Animation[]>([]);

  // The figure on screen and the one leaving it (kept only while its transition runs).
  const [shown, setShown] = useState(index);
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  if (shown !== index) {
    setShown(index);
    if (canAnimate())
      setLeaving((l) => ({
        index: shown,
        dir: index > shown ? 1 : -1,
        n: (l?.n ?? 0) + 1,
      }));
  }

  // Load state of the stage image; Retry bumps `attempt`, which mounts a fresh <img> and fetches again.
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load | null>(null);
  const src = figureSrc(current, theme);
  const loadKey = `${current.id}|${src}|${attempt}`;
  const state = load?.key === loadKey ? load.state : "loading";

  useLayoutEffect(() => {
    for (const a of running.current) a.cancel();
    running.current = [];
    const out = leavingRef.current;
    if (!leaving || !out) return;
    const full = document.documentElement.dataset.motion === "full";
    const timing: KeyframeAnimationOptions = {
      duration: full ? 220 : 150,
      easing: "ease-out",
    };
    const exit = out.animate(
      full
        ? [
            { opacity: 1, transform: "translateX(0)" },
            { opacity: 0, transform: `translateX(${-12 * leaving.dir}px)` },
          ]
        : [{ opacity: 1 }, { opacity: 0 }],
      { ...timing, fill: "forwards" },
    );
    const enter = currentRef.current?.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      timing,
    );
    running.current = enter ? [exit, enter] : [exit];
    const n = leaving.n;
    exit.finished.then(
      () => setLeaving((l) => (l?.n === n ? null : l)),
      () => {
        // Cancelled by a newer press: that press owns the transition now.
      },
    );
  }, [leaving]);

  useEffect(
    () => () => {
      for (const a of running.current) a.cancel();
    },
    [],
  );

  const go = (to: FigureNav) => {
    if (to.index !== index) onIndexChange(to.index);
  };
  const nav: FigureNav = { index, count };

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    const to =
      event.key === "ArrowRight"
        ? stepFigure(nav, 1)
        : event.key === "ArrowLeft"
          ? stepFigure(nav, -1)
          : event.key === "Home"
            ? jumpFigure(nav, "first")
            : event.key === "End"
              ? jumpFigure(nav, "last")
              : null;
    if (!to) return;
    // Handled here: the panel leaves a prevented keypress alone (it would move the project otherwise).
    event.preventDefault();
    go(to);
    if ((event.target as HTMLElement).getAttribute("role") === "tab")
      tabRefs.current[to.index]?.focus();
  }

  const stageId = `${uid}-stage`;
  const tabId = (i: number) => `${uid}-tab-${i}`;
  const atStart = index === 0;
  const atEnd = index === count - 1;
  const leavingFigure = leaving ? figures[leaving.index] : undefined;

  return (
    <div className={styles.scroll} onKeyDown={onKeyDown}>
      <div className={styles.stageWrap}>
        <div
          role="tabpanel"
          id={stageId}
          aria-labelledby={tabId(index)}
          tabIndex={0}
          data-state={state}
          className={cn(styles.stage, FOCUS)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.target === event.currentTarget) {
              event.preventDefault();
              onEnlarge(index);
            }
          }}
        >
          {leavingFigure ? (
            <div
              key={leaving!.n}
              ref={leavingRef}
              data-figure-leaving=""
              aria-hidden="true"
              className={styles.layer}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- figure urls are admin-supplied and may be any host */}
              <img
                src={figureSrc(leavingFigure, theme)}
                alt=""
                width={leavingFigure.width}
                height={leavingFigure.height}
                className={styles.figure}
              />
            </div>
          ) : null}
          <div ref={currentRef} className={styles.layer}>
            {state === "error" ? (
              <div className={styles.error}>
                <p>{t("figureError")}</p>
                <button
                  type="button"
                  onClick={() => setAttempt((a) => a + 1)}
                  className={cn(styles.retry, FOCUS)}
                >
                  {t("retry")}
                </button>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- figure urls are admin-supplied and may be any host
              <img
                key={loadKey}
                src={src}
                alt={current.alt}
                width={current.width}
                height={current.height}
                className={styles.figure}
                onLoad={() => setLoad({ key: loadKey, state: "loaded" })}
                onError={() => setLoad({ key: loadKey, state: "error" })}
                onClick={() => onEnlarge(index)}
              />
            )}
          </div>
        </div>
        <span className={styles.seal}>
          <b aria-hidden="true" lang="ja">
            {current.kanji}
          </b>
          <span>{t(`categories.${current.category}`)}</span>
        </span>
        <button
          type="button"
          onClick={() => onEnlarge(index)}
          className={cn(styles.enlarge, FOCUS)}
        >
          <Maximize2Icon aria-hidden="true" className="size-3.5" />
          {t("enlarge")}
        </button>
        <button
          type="button"
          aria-label={t("prevFigure")}
          aria-disabled={atStart || undefined}
          onClick={() => go(stepFigure(nav, -1))}
          className={cn(styles.side, styles.sidePrev, FOCUS)}
        >
          <ChevronLeftIcon aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          aria-label={t("nextFigure")}
          aria-disabled={atEnd || undefined}
          onClick={() => go(stepFigure(nav, 1))}
          className={cn(styles.side, styles.sideNext, FOCUS)}
        >
          <ChevronRightIcon aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div className={styles.captionBox}>
        <p className={styles.caption}>{current.caption}</p>
        <p className={styles.note}>{current.note}</p>
      </div>

      <div className={styles.stripRow}>
        <div role="tablist" aria-label={t("figures")} className={styles.strip}>
          {figures.map((figure, i) => (
            <button
              key={figure.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={tabId(i)}
              aria-selected={i === index}
              aria-controls={stageId}
              aria-label={figure.caption}
              tabIndex={i === index ? 0 : -1}
              onClick={() => go(jumpFigure(nav, i))}
              className={cn(styles.tab, FOCUS)}
              style={{ "--i": i } as CSSProperties}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- figure urls are admin-supplied and may be any host */}
              <img
                src={figureSrc(figure, theme)}
                alt=""
                loading="lazy"
                width={figure.width}
                height={figure.height}
              />
              <span aria-hidden="true" lang="ja" className={styles.tabKanji}>
                {figure.kanji}
              </span>
            </button>
          ))}
        </div>
        <span aria-hidden="true" className={styles.count}>
          {index + 1} / {count}
        </span>
      </div>

      <p className="sr-only" aria-live="polite">
        {`${t("figurePosition", { n: index + 1, count })}: ${current.caption}`}
      </p>
    </div>
  );
}
