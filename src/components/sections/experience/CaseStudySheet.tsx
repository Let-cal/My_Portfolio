"use client";

import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** A case study with its text already picked for the current locale. */
export type CaseStudyView = { problem: string; role: string; decisions: string; result: string };

const SECTIONS = ["problem", "role", "decisions", "result"] as const;

type CaseStudySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sheet title, e.g. "<position> · <company>". */
  title: string;
  /** Secondary line under the title, e.g. "<parent company> · <period>". */
  description?: string;
  caseStudy: CaseStudyView;
  teamSize?: string | null;
  tech?: string[];
  /** Element that gets focus back when the sheet closes (the item that opened it). */
  returnFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * Side drawer with the Problem / Role / Decisions / Result write-up of one experience or project.
 * Radix Dialog underneath: Esc and the close button dismiss it, focus is trapped while open.
 */
export function CaseStudySheet({
  open,
  onOpenChange,
  title,
  description,
  caseStudy,
  teamSize,
  tech = [],
  returnFocusRef,
}: CaseStudySheetProps) {
  const t = useTranslations("caseStudy");
  const tc = useTranslations("common");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={tc("close")}
        className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef?.current;
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <SheetHeader className="gap-1 border-b border-border p-5 pr-14 sm:p-6 sm:pr-14">
          <SheetTitle className="text-lg leading-snug sm:text-xl">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>

        <div className="flex flex-col gap-6 p-5 sm:p-6">
          {SECTIONS.map((key) => (
            <section key={key} aria-labelledby={`case-study-${key}`}>
              <h3 id={`case-study-${key}`} className="font-heading text-sm font-semibold tracking-wide text-brand-text uppercase">
                {t(key)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90 sm:text-base">{caseStudy[key]}</p>
            </section>
          ))}

          {teamSize ? <p className="text-sm text-muted-foreground">{t("team", { size: teamSize })}</p> : null}

          {tech.length > 0 ? (
            <section aria-labelledby="case-study-tech">
              <h3 id="case-study-tech" className="font-heading text-sm font-semibold tracking-wide text-brand-text uppercase">
                {t("tech")}
              </h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {tech.map((name) => (
                  <li key={name} className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs text-foreground/90">
                    {name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
