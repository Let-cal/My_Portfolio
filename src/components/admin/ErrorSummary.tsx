"use client";

import { motion } from "motion/react";
import { useEffect, useId, useRef } from "react";
import type { FieldError } from "@/lib/admin/validation";

/** Focuses the input with `id` and scrolls it into view (instantly when motion is reduced). */
export function focusField(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
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
  idFor = (e) => `field-${e.path}`,
}: {
  errors: FieldError[];
  focusKey: number;
  /** Input id for an error (forms that share a page prefix their ids; chips share one input). */
  idFor?: (e: FieldError) => string;
}) {
  const titleId = useId();
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
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      ref={ref}
      tabIndex={-1}
      // GOV.UK Frontend v5: the summary is focused on a failed save, which reads it; an alert
      // role on top would announce it twice.
      role="region"
      aria-labelledby={titleId}
      className="rounded-lg border-2 border-destructive/60 bg-destructive/5 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
    >
      <h2 id={titleId} className="text-base font-semibold">
        Có {errors.length} mục cần sửa
      </h2>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {errors.map((e) => (
          <li key={e.path}>
            <a
              href={`#${idFor(e)}`}
              className="text-destructive underline underline-offset-2 hover:no-underline"
              onClick={(ev) => {
                ev.preventDefault();
                focusField(idFor(e));
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
