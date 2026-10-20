/** `high` = full scene; `low` = fewer points, no bloom, no reflections; `off` = static image instead of a canvas (spec 7.5). */
export type Tier = "high" | "low" | "off";

export type TierInput = {
  webgl: boolean;
  reducedMotion: boolean;
  isMobile: boolean;
  cores: number;
};

/** Mobile, no WebGL or reduced motion: static scene. Low-core desktops keep the lighter live scene. */
export function detectTier(i: TierInput): Tier {
  if (!i.webgl || i.reducedMotion || i.isMobile) return "off";
  if (i.cores <= 4) return "low";
  return "high";
}

/** Samples needed before the average frame rate means anything (about one second at 60 fps). */
export const MIN_FPS_SAMPLES = 60;
export const DOWNGRADE_BELOW_FPS = 40;

/** True when at least 60 samples average under 40 fps: the scene should drop to the `low` tier. */
export function shouldDowngrade(fps: number[]): boolean {
  if (fps.length < MIN_FPS_SAMPLES) return false;
  let sum = 0;
  for (const v of fps) sum += v;
  return sum / fps.length < DOWNGRADE_BELOW_FPS;
}

/** Phones and small tablets: narrow screens, or a touch-only primary input. */
export const MOBILE_QUERY =
  "(max-width: 767px), (hover: none) and (pointer: coarse)";

let webglSupport: boolean | undefined;

/** Browser only. Probes once for a WebGL context (the result is cached). */
export function detectWebGL(): boolean {
  if (webglSupport !== undefined) return webglSupport;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    webglSupport = !!gl;
    // Give the probe context back right away (browsers cap the number of live contexts). A failure
    // here must not turn a working WebGL into "unsupported".
    try {
      (gl as WebGLRenderingContext | null)
        ?.getExtension("WEBGL_lose_context")
        ?.loseContext();
    } catch {
      // ignore
    }
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}
