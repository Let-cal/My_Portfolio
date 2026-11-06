"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { FigureScrollProps } from "./FigureScroll";
import styles from "./figures.module.css";

/**
 * The figures view's boxes without content: the stage (with its washi skeleton), the caption lines and the
 * filmstrip row, at the sizes the real view has. Shown while the chunk loads, so the panel's fit measure sees the
 * final layout and nothing moves when the view arrives.
 */
function ReservedBox({ message }: { message?: string }) {
  return (
    <div className={styles.scroll}>
      <div className={styles.stageWrap}>
        <div
          className={styles.stage}
          data-state={message ? "error" : "loading"}
        >
          {message ? (
            <div className={styles.layer}>
              <p className={styles.error}>{message}</p>
            </div>
          ) : null}
        </div>
      </div>
      <div aria-hidden="true" className={styles.captionBox}>
        <p className={styles.caption} />
        <p className={styles.note} />
      </div>
      <div aria-hidden="true" className={styles.stripRow}>
        <div className={styles.strip} />
      </div>
    </div>
  );
}

/** The chunk did not load (offline, a stale deploy): the reserved box says the figures could not be shown. */
function ChunkFailed() {
  const t = useTranslations("caseStudy");
  return <ReservedBox message={t("figureError")} />;
}

/**
 * The figures view, loaded on first use as its own chunk (the panel chunk only carries the toggle and this
 * wrapper). Client only: the panel itself is.
 */
export const LazyFigureScroll = dynamic<FigureScrollProps>(
  () =>
    import("./FigureScroll").then(
      (module) => module.FigureScroll,
      (error) => {
        console.warn("[case study] figures chunk failed", error);
        return ChunkFailed;
      },
    ),
  { ssr: false, loading: () => <ReservedBox /> },
);
