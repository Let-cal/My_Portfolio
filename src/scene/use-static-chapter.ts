import { useEffect } from "react";
import { DRAGON_CHAPTER } from "./chapters";
import { sceneStore } from "./store";

/** Static backgrounds only need koi/dragon, not the continuous 3D camera coordinates. */
export function useStaticChapterTracking(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const why = document.getElementById("why");
    if (!why) return;
    let disposed = false;
    const update = (dragon: boolean) => {
      if (!disposed) sceneStore.setState({ chapter: dragon ? DRAGON_CHAPTER : 0, t: 0 });
    };
    if (typeof IntersectionObserver === "undefined") {
      const measure = () => update(why.getBoundingClientRect().top <= window.innerHeight / 2);
      measure(); window.addEventListener("scroll", measure, { passive: true }); window.addEventListener("resize", measure);
      return () => { disposed = true; window.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); };
    }
    let observer: IntersectionObserver, generation = 0;
    const observe = () => {
      observer?.disconnect();
      const current = ++generation;
      // Percentage IO margins use viewport width, even on the vertical axis.
      observer = new IntersectionObserver(([entry]) => {
        if (entry && current === generation) update(entry.isIntersecting || entry.boundingClientRect.top < 0);
      }, { rootMargin: `0px 0px -${window.innerHeight / 2}px 0px` });
      observer.observe(why);
    };
    observe(); window.addEventListener("resize", observe);
    return () => { disposed = true; observer.disconnect(); window.removeEventListener("resize", observe); };
  }, [enabled]);
}
