import { FIG_PARAM } from "@/lib/case-list";

/** Where the figures view is: the current figure (0-based) of `count`. */
export type FigureNav = { index: number; count: number };

const clamp = (n: number, count: number) =>
  Math.min(Math.max(n, 0), Math.max(count - 1, 0));

/** One figure back or forward, stopping at the first and the last (no wrap). */
export function stepFigure(nav: FigureNav, delta: -1 | 1): FigureNav {
  return { index: clamp(nav.index + delta, nav.count), count: nav.count };
}

/** Straight to the first, the last or a given figure (clamped). */
export function jumpFigure(
  nav: FigureNav,
  to: "first" | "last" | number,
): FigureNav {
  const index = to === "first" ? 0 : to === "last" ? nav.count - 1 : to;
  return { index: clamp(index, nav.count), count: nav.count };
}

/**
 * The figure index (0-based) that `?fig=` asks for among `count` figures: null when the project has none or the
 * param is absent; a value that is not a whole number from 1 to `count` opens the first figure.
 */
export function parseFigParam(search: string, count: number): number | null {
  const raw = new URLSearchParams(search).get(FIG_PARAM);
  if (raw === null || count === 0) return null;
  const n = /^\d+$/.test(raw) ? Number(raw) : 0;
  return n >= 1 && n <= count ? n - 1 : 0;
}

/**
 * Rewrites `&fig=` (1-based; null removes it) in place with `replaceState`, only when it changes. Lives here, in
 * the panel's lazy chunk, rather than next to `?case=` in the initial bundle.
 */
export function writeFigParam(n: number | null) {
  const url = new URL(window.location.href);
  const value = n === null ? null : String(n);
  if (url.searchParams.get(FIG_PARAM) === value) return;
  if (value === null) url.searchParams.delete(FIG_PARAM);
  else url.searchParams.set(FIG_PARAM, value);
  window.history.replaceState(null, "", url);
}

const DIGITS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** A position (1 to 99) in kanji numerals for the spine, e.g. 12 is written ten-two. */
export function figureNumeral(n: number): string {
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (tens === 0) return DIGITS[ones];
  return `${tens === 1 ? "" : DIGITS[tens]}十${DIGITS[ones]}`;
}
