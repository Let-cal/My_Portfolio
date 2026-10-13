"use client";

import { useEffect, useState } from "react";
import { SECTION_IDS, type SectionId } from "./sections";

/** A thin band across the middle of the viewport: the section crossing it is the one being read. */
export const ACTIVE_ROOT_MARGIN = "-45% 0px -50% 0px";

/**
 * Id of the section currently crossing the reading line (null until the observer reports, or when the
 * page has no section ids). Used by the side rail and the pill nav.
 */
export function useActiveSection(): SectionId | null {
  const [active, setActive] = useState<SectionId | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id as SectionId);
        }
      },
      { rootMargin: ACTIVE_ROOT_MARGIN },
    );
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return active;
}
