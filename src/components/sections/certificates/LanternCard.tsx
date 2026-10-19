"use client";

import { useTranslations } from "next-intl";
import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
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

/**
 * A certificate as a paper lantern that flips. The card is ONE toggle button (`aria-pressed`) laid over the whole
 * lantern, so Enter, Space and a click all flip it. The front (name, organization, issue date) is its visible
 * content; the back (credential ID, Verify, View file, description) is a sibling layer that is `inert` and hidden
 * from assistive tech until flipped, so its links are keyboard reachable only when you can see them. Links sit above
 * the button; any other click on the back falls through to it and flips back. Escape also flips back.
 * Rotation lives in CSS (`.lantern-flip`); reduced motion crossfades instead.
 */
export function LanternCard({
  cert,
  index,
  front,
  back,
}: {
  cert: CertificateView;
  index: number;
  front: ReactNode;
  back: ReactNode;
}) {
  const t = useTranslations("certificates");
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
          {front}

          <div
            data-lantern-back=""
            inert={!flipped}
            aria-hidden={flipped ? undefined : true}
            className="lantern-face lantern-back"
          >
            {back}
          </div>
        </div>
      </LanternFrame>
    </div>
  );
}
