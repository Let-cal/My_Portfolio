"use client";

import { Spotlight } from "@/components/fx/Spotlight";
import { ScrollProgressKoi } from "./ScrollProgressKoi";

/**
 * The pointer glow (z-0, under the page content) and the reading-progress thread along the top edge (z-50).
 * Loaded as one chunk by DeferredDecor.
 */
export default function DecorLayers() {
  return (
    <>
      <Spotlight />
      <ScrollProgressKoi />
    </>
  );
}
