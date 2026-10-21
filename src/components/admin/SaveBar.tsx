"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  expireAdminSession,
  isAdminSessionBlocked,
} from "@/lib/admin/action-errors";

// Every form with unsaved edits registers here; one shared listener asks once, however many are dirty.
const dirtyForms = new Set<object>();

function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
}

/** True when it is fine to leave: nothing unsaved, or the user agreed to drop it. Asks at most once. */
export function confirmLeave(): boolean {
  if (isAdminSessionBlocked()) {
    expireAdminSession();
    return false;
  }
  return (
    dirtyForms.size === 0 ||
    window.confirm(
      "Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?",
    )
  );
}

function onLinkClick(e: MouseEvent) {
  if (isAdminSessionBlocked()) return; // The session guard handles this before the unsaved prompt.
  const link = (e.target as Element | null)?.closest?.("a[href]");
  if (
    !link ||
    link.getAttribute("target") === "_blank" ||
    link.getAttribute("href")?.startsWith("#")
  )
    return;
  if (!confirmLeave()) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function syncGuard() {
  if (dirtyForms.size > 0) {
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onLinkClick, true);
  } else {
    window.removeEventListener("beforeunload", onBeforeUnload);
    document.removeEventListener("click", onLinkClick, true);
  }
}

/** Asks before the tab closes, and before following an in-app link, while there are unsaved edits. */
export function useUnsavedGuard(dirty: boolean) {
  const token = useRef({});
  useEffect(() => {
    if (!dirty) return;
    const form = token.current;
    dirtyForms.add(form);
    syncGuard();
    return () => {
      dirtyForms.delete(form);
      syncGuard();
    };
  }, [dirty]);
}

/**
 * Bottom bar of every admin form: status on the left (unsaved, errors, saved), actions on the
 * right. Ctrl/⌘+S triggers `onSave` from anywhere on the page.
 */
export function SaveBar({
  dirty,
  pending,
  saved,
  errorCount,
  onSave,
  onShowErrors,
  onCancel,
  active = true,
}: {
  /** Only the form on screen answers Ctrl/⌘+S (several forms can share a page). */
  active?: boolean;
  dirty: boolean;
  pending: boolean;
  saved: boolean;
  errorCount: number;
  onSave: () => void;
  onShowErrors: () => void;
  onCancel?: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!pending && !e.repeat) onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave, active, pending]);

  return (
    <div
      role="region"
      aria-label="Lưu thay đổi"
      className={cn(
        "sticky bottom-0 z-30 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur",
        dirty && "shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.35)]",
      )}
    >
      <div
        aria-live="polite"
        className="flex min-h-8 items-center gap-2 text-sm"
      >
        {errorCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={onShowErrors}
          >
            {errorCount} lỗi · Xem
          </Button>
        ) : dirty ? (
          <motion.span
            key="dirty"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 text-muted-foreground"
          >
            <span aria-hidden className="size-2 rounded-full bg-amber-500" />
            Có thay đổi chưa lưu
          </motion.span>
        ) : saved ? (
          <motion.span
            key="saved"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-emerald-600 dark:text-emerald-400"
          >
            Đã lưu ✓
          </motion.span>
        ) : null}
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Ctrl/⌘+S để lưu
        </span>
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Hủy
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu"}
        </Button>
      </div>
    </div>
  );
}
