"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { useRevealOnView } from "@/components/fx/use-reveal-on-view";

/**
 * "How I work": the short working principles from `footer.principles`, one numbered line each. The lines come
 * in one after another (a growing `--i` delay) when the list scrolls into view. They are plain visible text
 * until the observer has measured the list off-screen, and reduced motion keeps them static (globals.css).
 */
export function FooterPrinciples() {
  const t = useTranslations("footer");
  const principles = [0, 1, 2, 3].map((index) => t(`principles.${index}`));
  const { ref, armed, shown } = useRevealOnView<HTMLOListElement>(0.35);

  return (
    <div>
      <h2
        data-scene-avoid=""
        className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase"
      >
        {t("principlesLabel")}
      </h2>
      <ol
        ref={ref}
        role="list"
        aria-label={t("principlesLabel")}
        data-footer-principles=""
        data-scene-avoid="box"
        data-armed={armed ? "" : undefined}
        data-shown={shown ? "" : undefined}
        className="mt-6 grid gap-x-12 sm:grid-cols-2"
      >
        {principles.map((line, i) => (
          <li
            key={i}
            style={{ "--i": i } as CSSProperties}
            className="footer-principle flex gap-4 border-t border-border py-5 text-lg leading-snug text-balance sm:text-xl"
          >
            <span
              aria-hidden="true"
              className="pt-1 font-mono text-xs text-muted-foreground tabular-nums"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
