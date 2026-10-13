"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./theme-script";

export type Theme = "dark" | "light";

const THEME_EVENT = "letcal-theme-change";

function readTheme(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Applies `theme` to <html> (swapping `dark` and `light`), persists it and notifies subscribers. */
export function applyTheme(theme: Theme) {
  const classes = document.documentElement.classList;
  classes.remove("dark", "light");
  classes.add(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked (private mode); the class change still applies for this visit.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** The theme class on <html> is the single source of truth. The server snapshot is `dark`, the default. */
export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as const);
  const setTheme = useCallback((next: Theme) => applyTheme(next), []);
  return { theme, setTheme };
}

/**
 * Re-applies the saved theme after a client-side locale switch. Switching locale swaps the root layout,
 * which creates a fresh <html class="dark"> and the pre-paint script does not run again.
 * No-op on first load (the script has already set the class).
 */
export function restoreSavedTheme() {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return;
  }
  const next: Theme = saved === "light" ? "light" : "dark";
  if (next === readTheme()) return;
  const classes = document.documentElement.classList;
  classes.remove("dark", "light");
  classes.add(next);
  window.dispatchEvent(new Event(THEME_EVENT));
}
