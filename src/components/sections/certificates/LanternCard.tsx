"use client";

import { ExternalLinkIcon, RotateCwIcon } from "@/components/site/icons";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { LanternFrame } from "./LanternFrame";

/** One certificate with every string already picked for the current locale. */
export type CertificateView = {
  id: string;
  name: string;
  organization: string;
  /** Issue date, formatted for the locale ("Dec 2024"). */
  issued: string;
  credentialId: string | null;
  credentialUrl: string | null;
  fileUrl: string | null;
  topic: string;
  description: string;
};

const LINK =
  "pointer-events-auto relative inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-(--role-accent-text) underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * A certificate as a paper lantern that flips. The card is ONE toggle button (`aria-pressed`) laid over the whole
 * lantern, so Enter, Space and a click all flip it. The front (name, organization, issue date) is its visible
 * content; the back (credential ID, Verify, View file, description) is a sibling layer that is `inert` and hidden
 * from assistive tech until flipped, so its links are keyboard reachable only when you can see them. Links sit above
 * the button; any other click on the back falls through to it and flips back. Escape also flips back.
 * Rotation lives in CSS (`.lantern-flip`); reduced motion crossfades instead.
 */
export function LanternCard({ cert, index, topicLabel }: { cert: CertificateView; index: number; topicLabel: string }) {
  const t = useTranslations("certificates");
  const tp = useTranslations("projects");
  const [flipped, setFlipped] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hintId = useId();

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && flipped) {
      e.stopPropagation();
      setFlipped(false);
      buttonRef.current?.focus();
    }
  }

  return (
    <div onKeyDown={onKeyDown} className="contents">
      <LanternFrame index={index} flipped={flipped}>
        <button
          ref={buttonRef}
          type="button"
          aria-pressed={flipped}
          aria-describedby={hintId}
          onClick={() => setFlipped((v) => !v)}
          className="lantern-hit"
        >
          <span className="sr-only">
            {cert.name}, {cert.organization}, {cert.issued}
          </span>
        </button>
        <span id={hintId} className="sr-only">
          {t("flipHint")}
        </span>

        <div className="lantern-flip">
          {/* Front: decoration for the sighted; the button above carries the accessible name. */}
          <div aria-hidden="true" className="lantern-face lantern-front">
            <p className="text-[11px] font-medium tracking-[0.2em] text-(--role-accent-text) uppercase">{topicLabel}</p>
            <h3 className="mt-3 font-heading text-lg leading-snug font-semibold text-balance">{cert.name}</h3>
            <div className="mt-auto pt-5">
              <p className="text-sm text-foreground/90">{cert.organization}</p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{cert.issued}</p>
              <p className="mt-4 flex items-center gap-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
                <RotateCwIcon className="size-3" />
                {t("showDetails")}
              </p>
            </div>
          </div>

          <div
            data-lantern-back=""
            inert={!flipped}
            aria-hidden={flipped ? undefined : true}
            className="lantern-face lantern-back"
          >
            <p className="text-[11px] font-medium tracking-[0.2em] text-(--role-accent-text) uppercase">{t("credentialId")}</p>
            <p className="mt-1.5 font-mono text-sm break-all text-foreground">{cert.credentialId ?? "—"}</p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              {cert.credentialUrl ? (
                <a data-verify="" href={cert.credentialUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                  {t("verify")}
                  <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
                  <span className="sr-only"> {tp("newTab")}</span>
                </a>
              ) : null}
              {cert.fileUrl ? (
                <a href={cert.fileUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                  {t("viewFile")}
                  <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
                  <span className="sr-only"> {tp("newTab")}</span>
                </a>
              ) : null}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{cert.description}</p>

            <p
              aria-hidden="true"
              className={cn("mt-auto flex items-center gap-1.5 pt-4 text-[11px] tracking-wide text-muted-foreground uppercase")}
            >
              <RotateCwIcon className="size-3 -scale-x-100" />
              {t("showFront")}
            </p>
          </div>
        </div>
      </LanternFrame>
    </div>
  );
}
