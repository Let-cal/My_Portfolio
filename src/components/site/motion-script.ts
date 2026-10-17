export const MOTION_STORAGE_KEY = "motion";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Inline script that runs before first paint and writes `data-motion="reduced" | "full"` on <html>, so CSS
 * (and the Tailwind `motion-reduce` / `motion-safe` variants) follow the effective preference with no flash.
 * A saved `on` / `off` wins; otherwise the OS setting decides. Keep in step with `isMotionReduced` in motion-preference.ts.
 */
export const MOTION_INIT_SCRIPT = `(function(){var p=null;try{p=localStorage.getItem("${MOTION_STORAGE_KEY}")}catch(e){}var r=p==="off"||(p!=="on"&&!!window.matchMedia&&window.matchMedia("${REDUCED_MOTION_QUERY}").matches);document.documentElement.setAttribute("data-motion",r?"reduced":"full")})()`;
