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
import { LazyFigureViewer } from "./LazyFigureViewer";
import styles from "./figures.module.css";

export type FigureScrollProps = {
  figures: FigureView[];
  /** The current figure, 0-based. */
  index: number;
  onIndexChange: (i: number) => void;
  /** The project title, for the full-screen viewer's label. */
  title: string;
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
 *
 * Enlarge opens the full-screen viewer (spec 6.3) on the current figure. It is its own chunk, fetched on the first
 * Enlarge; it moves this view along with it, so on close the stage shows the figure it ended on and gets focus.
 */
export function FigureScroll({
  figures,
  index,
  onIndexChange,
  title,
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
  const stageRef = useRef<HTMLDivElement | null>(null);

  // The viewer chunk is requested on the first Enlarge only ("never" until then).
  const [viewer, setViewer] = useState<"never" | "open" | "closed">("never");
  const onEnlarge = () => setViewer("open");

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
    <>
      <div className={styles.scroll} onKeyDown={onKeyDown}>
        <div className={styles.stageWrap}>
          <div
            ref={stageRef}
            role="tabpanel"
            id={stageId}
            aria-labelledby={tabId(index)}
            tabIndex={0}
            data-state={state}
            className={cn(styles.stage, FOCUS)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                event.target === event.currentTarget
              ) {
                event.preventDefault();
                onEnlarge();
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
                    onClick={() => {
                      // The button unmounts with the retry; the stage keeps focus inside the view.
                      stageRef.current?.focus();
                      setAttempt((a) => a + 1);
                    }}
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
                  onClick={onEnlarge}
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
            onClick={onEnlarge}
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
          {/* Clamped to two lines (the note to one) in the wide panel: the full text is in the title. */}
          <p className={styles.caption} title={current.caption}>
            {current.caption}
          </p>
          <p className={styles.note} title={current.note ?? undefined}>
            {current.note}
          </p>
        </div>

        <div className={styles.stripRow}>
          <div
            role="tablist"
            aria-label={t("figures")}
            className={styles.strip}
          >
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
                  decoding="async"
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
      {/* A sibling of the view, not a child: its keys must not reach the view's own handler. */}
      {viewer === "never" ? null : (
        <LazyFigureViewer
          figures={figures}
          index={index}
          open={viewer === "open"}
          onIndexChange={onIndexChange}
          onClose={() => setViewer("closed")}
          title={title}
          theme={theme}
          returnFocusRef={stageRef}
        />
      )}
    </>
  );
}
