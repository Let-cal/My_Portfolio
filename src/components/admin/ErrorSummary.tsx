"use client";

import { useEffect, useRef } from "react";
import type { FieldError } from "@/lib/admin/validation";

/** Focuses the input with `id` and scrolls it into view (instantly when motion is reduced). */
export function focusField(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  el.focus({ preventScroll: true });
}

/**
 * "Có N mục cần sửa": shown after a failed save, focused each time `focusKey` changes, each
 * item a link to its field. Inline errors stay under the fields as well.
 */
export function ErrorSummary({
  errors,
  focusKey,
  idFor = (path) => `field-${path}`,
}: {
  errors: FieldError[];
  focusKey: number;
  /** Input id for an error path (forms that share a page prefix their ids). */
  idFor?: (path: string) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // A failed save may render the errors a moment after `focusKey` changes; focus once both exist.
  const wantFocus = useRef(0);
  const visible = errors.length > 0;
  useEffect(() => {
    if (focusKey > wantFocus.current && visible && ref.current) {
      wantFocus.current = focusKey;
      ref.current.focus();
    }
  }, [focusKey, visible]);
  if (!errors.length) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
      className="rounded-lg border-2 border-destructive/60 bg-destructive/5 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
    >
      <h2 id="error-summary-title" className="text-base font-semibold">
        Có {errors.length} mục cần sửa
      </h2>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {errors.map((e) => (
          <li key={e.path}>
            <a
              href={`#${idFor(e.path)}`}
              className="text-destructive underline underline-offset-2 hover:no-underline"
              onClick={(ev) => {
                ev.preventDefault();
                focusField(idFor(e.path));
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
