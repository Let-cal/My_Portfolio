import { REF_ASPECT } from "./environment/constants";

/** Where the visitor is in the story: the section being read and how far through it they have scrolled. */
export type ChapterProgress = { chapter: number; t: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The chapter is the last section whose top is at or above the middle of the viewport. `t` (0 to 1) is how far the
 * scroll has travelled through that chapter's own span: from the scroll position where its top reached the middle
 * of the viewport (the chapter began) to the one where the next section's top does (the next chapter begins). So `t`
 * is 0 on entering and just under 1 on leaving, whatever the section's height: a section only half a screen tall
 * still runs from 0 to 1. (Measuring from the section's top instead lost half a viewport of range, and a short
 * "Why me" never reached the end of its morph.) The first chapter begins at the top of the page. The last has no
 * next section, so one viewport height stands in for its length.
 */
export function getChapterProgress(scrollY: number, sectionTops: number[], viewportH: number): ChapterProgress {
  const half = viewportH * 0.5;
  const line = scrollY + half;
  let chapter = 0;
  for (let i = 0; i < sectionTops.length; i++) {
    if (sectionTops[i] <= line) chapter = i;
  }
  const top = sectionTops[chapter];
  if (top === undefined) return { chapter: 0, t: 0 };
  const next = sectionTops[chapter + 1];
  const start = Math.max(0, top - half);
  const end = next === undefined || !Number.isFinite(next) ? start + viewportH : next - half;
  const span = end - start;
  if (!(span > 0)) return { chapter, t: 0 };
  return { chapter, t: clamp01((scrollY - start) / span) };
}

export type TransformState = { morph: number; scatter: number };

export const TRANSFORM_START = 0.35;
export const TRANSFORM_END = 0.65;
/** The "Why me" chapter, where the koi turns into a dragon. */
export const DRAGON_CHAPTER = 5;

/**
 * How scattered the body is for a koi (0) to dragon (1) blend: 0 at both ends, 1 halfway. It is a function of the
 * blend, not of the scroll, so the creature scatters and gathers on the blend's own (eased) clock.
 */
export function scatterAt(morph: number): number {
  if (!(morph > 0) || morph >= 1) return 0;
  return Math.sin(Math.PI * morph);
}

/** Koi to dragon: morph goes 0 to 1 and scatter peaks at 1 halfway through chapter 5. Chapter 6 stays a dragon. */
export function transformState(chapter: number, t: number): TransformState {
  if (chapter < DRAGON_CHAPTER) return { morph: 0, scatter: 0 };
  if (chapter > DRAGON_CHAPTER) return { morph: 1, scatter: 0 };
  if (t <= TRANSFORM_START) return { morph: 0, scatter: 0 };
  if (t >= TRANSFORM_END) return { morph: 1, scatter: 0 };
  const p = (t - TRANSFORM_START) / (TRANSFORM_END - TRANSFORM_START);
  return { morph: p, scatter: scatterAt(p) };
}

// --- Camera per chapter ------------------------------------------------------------------------------------------

export type CameraPose = { pos: [number, number, number]; look: [number, number, number] };

/**
 * One camera per chapter, in pond units (water at y = -0.3, the koi swims around the origin, the camera sits at +z).
 * 0 pond from above and in front (as in the prototype), 1 river: lower and slanted, 2 lotus pond: nearly straight
 * down, 3 waterfall: low, looking along the water at the fall, 4 lanterns: low and wide so both banks show,
 * 5 gate: pulled back for the dragon, 6 contact: high and far, the dragon circles the call to action.
 */
export const CHAPTER_CAMERA: CameraPose[] = [
  { pos: [0, 3.8, 4.2], look: [0, -0.15, 0.1] },
  { pos: [-1.4, 2.5, 4.6], look: [0.6, -0.25, -0.4] },
  { pos: [0.4, 5.0, 2.8], look: [0, -0.3, -0.3] },
  { pos: [3.2, 4.0, 12.8], look: [0, 2.6, -4.5] },
  { pos: [0, 2.7, 5.6], look: [0, 0.1, -1.6] },
  { pos: [0, 3.6, 6.4], look: [0, 0.35, -1] },
  { pos: [0, 5.4, 7.8], look: [0, 0.9, -0.2] },
];

/** The camera holds a chapter's pose for this share of the chapter, then eases to the next chapter's pose. */
export const CAMERA_HOLD = 0.5;

const smooth01 = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Where the story is as a number: the chapter, plus how far the camera has moved on towards the next one. Chapter
 * `c` with `t` up to 0.5 is exactly `c`; at `t = 1` it is `c + 1`. The last chapter has nothing to move on to.
 */
export function chapterPosition(chapter: number, t: number): number {
  const c = Math.min(CHAPTER_CAMERA.length - 1, Math.max(0, Math.floor(chapter)));
  if (c >= CHAPTER_CAMERA.length - 1) return c;
  return c + smooth01(CAMERA_HOLD, 1, t);
}

type Vec3Like = { x: number; y: number; z: number };

/** The camera at a chapter position (see `chapterPosition`): the table, interpolated linearly. Writes into `out`. */
export function cameraAtPosition(position: number, out: { pos: Vec3Like; look: Vec3Like }): void {
  const last = CHAPTER_CAMERA.length - 1;
  const p = Math.min(last, Math.max(0, position));
  const i = Math.min(last - 1, Math.floor(p));
  const f = p - i;
  const a = CHAPTER_CAMERA[i];
  const b = CHAPTER_CAMERA[i + 1];
  out.pos.x = a.pos[0] * (1 - f) + b.pos[0] * f;
  out.pos.y = a.pos[1] * (1 - f) + b.pos[1] * f;
  out.pos.z = a.pos[2] * (1 - f) + b.pos[2] * f;
  out.look.x = a.look[0] * (1 - f) + b.look[0] * f;
  out.look.y = a.look[1] * (1 - f) + b.look[1] * f;
  out.look.z = a.look[2] * (1 - f) + b.look[2] * f;
}

/** The camera for a scroll state: `cameraAtPosition(chapterPosition(chapter, t))`. */
export function cameraAt(chapter: number, t: number, out: { pos: Vec3Like; look: Vec3Like }): void {
  cameraAtPosition(chapterPosition(chapter, t), out);
}

/** The farthest the camera is pulled back on a very narrow screen. */
const MAX_PULLBACK = 2.2;

/**
 * How far to move the camera back (a multiplier of its distance to what it looks at) so a portrait screen still
 * sees the creature: 1 on landscape, up to 2.2 on a thin phone.
 */
export function aspectPullback(aspect: number): number {
  if (!(aspect < REF_ASPECT)) return 1;
  return Math.min(MAX_PULLBACK, Math.pow(REF_ASPECT / Math.max(aspect, 0.01), 0.55));
}
