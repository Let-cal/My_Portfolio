"use client";

import { Suspense, lazy, useEffect, useState } from "react";
import type { RoleKey } from "@/content/schema";
import { isPaletteShortcut } from "./command-shortcut";

const loadDialog = () => import("./CommandPaletteDialog");
const Dialog = lazy(() => loadDialog().then((m) => ({ default: m.CommandPaletteDialog })));

/**
 * ⌘K / Ctrl+K command palette. This thin shell is all that ships with the first page: it listens for the shortcut
 * and for the `open-command` event (the header button fires it), and loads the dialog (cmdk, the dialog UI, the
 * command list) the first time it is needed. The dialog chunk is also fetched when the browser is idle, so the
 * first open is normally instant.
 */
export function CommandPalette({ cvUrls, email }: { cvUrls: Record<RoleKey, string>; email: string }) {
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (requested) return;
    const request = () => setRequested(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPaletteShortcut(event)) return;
      event.preventDefault();
      request();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command", request);

    const warm = () => void loadDialog();
    const idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(warm, { timeout: 4000 }) : window.setTimeout(warm, 2000);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command", request);
      if (typeof window.requestIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [requested]);

  if (!requested) return null;
  return (
    <Suspense fallback={null}>
      <Dialog cvUrls={cvUrls} email={email} initialOpen />
    </Suspense>
  );
}
