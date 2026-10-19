"use client";

import { useCallback, useSyncExternalStore } from "react";
import { MOTION_STORAGE_KEY, REDUCED_MOTION_QUERY } from "./motion-script";

/** `system` follows the OS "reduce motion" setting; `on` always animates; `off` always shows the static design. */
export type MotionPreference = "system" | "on" | "off";

const MOTION_EVENT = "letcal-motion-change";

// Only used when localStorage throws (private mode), so the toggle still works for the current visit.
let memoryPref: MotionPreference | null = null;

function osPrefersReduced(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

/** The saved choice (`system` when nothing, or junk, is stored). */
export function getMotionPreference(): MotionPreference {
  try {
    const saved = window.localStorage.getItem(MOTION_STORAGE_KEY);
    return saved === "on" || saved === "off" ? saved : "system";
  } catch {
    return memoryPref ?? "system";
  }
}

export function isMotionReduced(
  pref: MotionPreference,
  osReduced: boolean,
): boolean {
  return pref === "off" || (pref === "system" && osReduced);
}

/** True when the page should show its static design: the saved choice, else the OS setting. */
export function getMotionReduced(): boolean {
  return isMotionReduced(getMotionPreference(), osPrefersReduced());
}

/** Writes the effective state to <html data-motion> (what the pre-paint script does on first load). */
export function syncMotionAttribute() {
  document.documentElement.dataset.motion = getMotionReduced()
    ? "reduced"
    : "full";
}

/**
 * Saves the choice (`system` removes it), updates <html data-motion> and notifies subscribers.
 * The command palette (Task 12) calls this for "Motion: System / On / Off".
 */
export function setMotionPreference(pref: MotionPreference) {
  try {
    if (pref === "system") window.localStorage.removeItem(MOTION_STORAGE_KEY);
    else window.localStorage.setItem(MOTION_STORAGE_KEY, pref);
    memoryPref = null;
  } catch {
    memoryPref = pref;
  }
  syncMotionAttribute();
  window.dispatchEvent(new Event(MOTION_EVENT));
}

function subscribe(onChange: () => void) {
  const mql =
    typeof window.matchMedia === "function"
      ? window.matchMedia(REDUCED_MOTION_QUERY)
      : null;
  const onSystemChange = () => {
    syncMotionAttribute();
    onChange();
  };
  window.addEventListener(MOTION_EVENT, onChange);
  window.addEventListener("storage", onSystemChange);
  mql?.addEventListener?.("change", onSystemChange);
  return () => {
    window.removeEventListener(MOTION_EVENT, onChange);
    window.removeEventListener("storage", onSystemChange);
    mql?.removeEventListener?.("change", onSystemChange);
  };
}

/** The saved preference, the effective `reduced` flag and a setter. Server snapshot: `system`, not reduced. */
export function useMotionPreference(): {
  pref: MotionPreference;
  reduced: boolean;
  setPref: (pref: MotionPreference) => void;
} {
  const pref = useSyncExternalStore(
    subscribe,
    getMotionPreference,
    () => "system" as const,
  );
  const reduced = useSyncExternalStore(
    subscribe,
    () => isMotionReduced(getMotionPreference(), osPrefersReduced()),
    () => false,
  );
  const setPref = useCallback(
    (next: MotionPreference) => setMotionPreference(next),
    [],
  );
  return { pref, reduced, setPref };
}

/** The effective reduced-motion flag alone (what `usePrefersReducedMotion` returns). */
export function useReducedMotionEffective(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isMotionReduced(getMotionPreference(), osPrefersReduced()),
    () => false,
  );
}
