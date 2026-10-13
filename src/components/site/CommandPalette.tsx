"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { RoleKey } from "@/content/schema";
import { isPaletteShortcut } from "./command-shortcut";

type PaletteProps = { cvUrls: Record<RoleKey, string>; email: string };
type DialogComponent = ComponentType<PaletteProps & { initialOpen?: boolean }>;

const loadDialog = () => import("./CommandPaletteDialog");

/**
 * ⌘K / Ctrl+K command palette. This thin shell is all that ships with the first page: it listens for the shortcut
 * and for the `open-command` event (the header button fires it), and loads the dialog (cmdk, the dialog UI, the
 * command list) the first time it is needed. The dialog chunk is also fetched when the browser is idle, so the
 * first open is normally instant.
 *
 * A chunk that fails to load (stale deploy, offline) is not an error for the page: nothing opens, the listeners stay
 * on, and the next open tries again.
 */
export function CommandPalette({ cvUrls, email }: PaletteProps) {
  const [Dialog, setDialog] = useState<DialogComponent | null>(null);

  useEffect(() => {
    if (Dialog) return;
    let alive = true;
    const request = () => {
      loadDialog()
        .then((module) => {
          const component = module.CommandPaletteDialog;
          if (alive) setDialog(() => component);
        })
        .catch(() => {
          // Leave the palette closed; a later shortcut or button press retries.
        });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPaletteShortcut(event)) return;
      event.preventDefault();
      request();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command", request);

    const warm = () => void loadDialog().catch(() => {});
    const idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(warm, { timeout: 4000 }) : window.setTimeout(warm, 2000);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command", request);
      if (typeof window.requestIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [Dialog]);

  return Dialog ? <Dialog cvUrls={cvUrls} email={email} initialOpen /> : null;
}
