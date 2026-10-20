"use client";

import { useEffect, useState } from "react";
import { MOBILE_IDLE_LOAD_MS } from "./loading";

const INTERACTION_EVENTS = [
  "pointerdown",
  "touchstart",
  "keydown",
  "wheel",
] as const;

function whenIdle(cb: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(cb, { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, 1);
  return () => window.clearTimeout(id);
}

/**
 * The three facts `shouldLoadScene` needs. `pageLoaded` turns true after the `load` event and a browser idle
 * callback; `idleMs` jumps to 3000 three seconds after that; `interacted` after the first touch, click, key press or wheel turn (not scroll: a restored scroll position would count).
 */
export function useLoadGate(): {
  pageLoaded: boolean;
  interacted: boolean;
  idleMs: number;
} {
  const [pageLoaded, setPageLoaded] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [idleMs, setIdleMs] = useState(0);

  useEffect(() => {
    let cancelIdle = () => {};
    let timer = 0;
    const onLoaded = () => {
      cancelIdle = whenIdle(() => {
        setPageLoaded(true);
        timer = window.setTimeout(
          () => setIdleMs(MOBILE_IDLE_LOAD_MS),
          MOBILE_IDLE_LOAD_MS,
        );
      });
    };
    if (document.readyState === "complete") onLoaded();
    else window.addEventListener("load", onLoaded, { once: true });
    return () => {
      window.removeEventListener("load", onLoaded);
      cancelIdle();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const onInteract = () => setInteracted(true);
    for (const type of INTERACTION_EVENTS)
      window.addEventListener(type, onInteract, { once: true, passive: true });
    return () => {
      for (const type of INTERACTION_EVENTS)
        window.removeEventListener(type, onInteract);
    };
  }, []);

  return { pageLoaded, interacted, idleMs };
}
