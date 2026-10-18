"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

function isApplePlatform(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /Mac|iPhone|iPad|iPod/i.test(nav.userAgentData?.platform || nav.platform || nav.userAgent || "");
}

/** The shortcut that opens the command palette, written for the visitor's platform: "⌘K" on Apple devices, "Ctrl K" elsewhere. */
export function useShortcutHint(): string {
  return useSyncExternalStore(noop, () => (isApplePlatform() ? "⌘K" : "Ctrl K"), () => "Ctrl K");
}
