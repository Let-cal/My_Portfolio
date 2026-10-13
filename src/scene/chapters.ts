/** Where the visitor is in the story: the section being read and how far through it they have scrolled. */
export type ChapterProgress = { chapter: number; t: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The chapter is the last section whose top is at or above the middle of the viewport. `t` (0 to 1) is how
 * far `scrollY` has travelled from that section's top to the next one's. The last chapter has no next
 * section, so one viewport height stands in for its length.
 */
export function getChapterProgress(scrollY: number, sectionTops: number[], viewportH: number): ChapterProgress {
  const line = scrollY + viewportH * 0.5;
  let chapter = 0;
  for (let i = 0; i < sectionTops.length; i++) {
    if (sectionTops[i] <= line) chapter = i;
  }
  const top = sectionTops[chapter];
  if (top === undefined) return { chapter: 0, t: 0 };
  const next = sectionTops[chapter + 1];
  const span = next === undefined ? viewportH : next - top;
  if (!(span > 0)) return { chapter, t: 0 };
  return { chapter, t: clamp01((scrollY - top) / span) };
}

export type TransformState = { morph: number; scatter: number };

export const TRANSFORM_START = 0.35;
export const TRANSFORM_END = 0.65;
/** The "Why me" chapter, where the koi turns into a dragon. */
export const DRAGON_CHAPTER = 5;

/** Koi to dragon: morph goes 0 to 1 and scatter peaks at 1 halfway through chapter 5. Chapter 6 stays a dragon. */
export function transformState(chapter: number, t: number): TransformState {
  if (chapter < DRAGON_CHAPTER) return { morph: 0, scatter: 0 };
  if (chapter > DRAGON_CHAPTER) return { morph: 1, scatter: 0 };
  if (t <= TRANSFORM_START) return { morph: 0, scatter: 0 };
  if (t >= TRANSFORM_END) return { morph: 1, scatter: 0 };
  const p = (t - TRANSFORM_START) / (TRANSFORM_END - TRANSFORM_START);
  return { morph: p, scatter: Math.sin(Math.PI * p) };
}
