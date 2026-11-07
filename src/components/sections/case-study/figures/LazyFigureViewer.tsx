"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import type { FigureViewerProps } from "./FigureViewer";

/** The chunk did not load (offline, a stale deploy): the request to open is dropped, the figures view stays. */
function ViewerFailed({ open, onClose }: FigureViewerProps) {
  useEffect(() => {
    if (open) onClose();
  }, [open, onClose]);
  return null;
}

/**
 * The full-screen viewer, loaded as its own chunk on the first Enlarge (the figures view chunk only carries this
 * wrapper). Nothing is shown while it loads: the figures view stays as it is until the dialog opens.
 */
export const LazyFigureViewer = dynamic<FigureViewerProps>(
  () =>
    import("./FigureViewer").then(
      (module) => module.FigureViewer,
      (error) => {
        console.warn("[case study] viewer chunk failed", error);
        return ViewerFailed;
      },
    ),
  { ssr: false, loading: () => null },
);
