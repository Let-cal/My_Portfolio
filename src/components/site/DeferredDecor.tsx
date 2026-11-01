"use client";

import dynamic from "next/dynamic";

/*
 * Decorative layers loaded after hydration in their own chunk, so they are not part of the first page's
 * JavaScript. Neither changes what the server paints: the spotlight renders nothing until a fine pointer is
 * known (always after hydration), and the scroll thread starts at zero, with its koi parked off-screen to the
 * left. Both are aria-hidden and pointer-events-none, and their z-index (0 and 50) sets their stacking, not
 * their place in the DOM.
 */
const DecorLayers = dynamic(() => import("./DecorLayers"), { ssr: false });

export function DeferredDecor() {
  return <DecorLayers />;
}
