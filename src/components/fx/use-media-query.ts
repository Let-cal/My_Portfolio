import { useSyncExternalStore } from "react";
import { useReducedMotionEffective } from "@/components/site/motion-preference";

/**
 * Subscribes to a media query without per-render state. Returns `serverValue` during SSR/hydration
 * and `false` when matchMedia is unavailable (old browsers, jsdom).
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const mql = window.matchMedia(query);
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
      }
      mql.addListener?.(onChange);
      return () => mql.removeListener?.(onChange);
    },
    () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false),
    () => serverValue,
  );
}

/**
 * True when the page should show its static design: the visitor's Motion toggle (`on` / `off`) wins,
 * otherwise the OS "reduce motion" setting decides. Effects then show their final state.
 */
export function usePrefersReducedMotion(): boolean {
  return useReducedMotionEffective();
}
