"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const JapaneseFontFace = dynamic(() => import("./JapaneseFontFace"), {
  ssr: false,
});

/** Japanese system fonts render immediately; fetch the optional web face on the first interaction. */
export function JapaneseTypography() {
  const [interacted, setInteracted] = useState(false);
  useEffect(() => {
    if (interacted) return;
    const events = ["pointerdown", "touchstart", "wheel", "keydown"] as const;
    const activate = () => setInteracted(true);
    for (const event of events)
      window.addEventListener(event, activate, { once: true, passive: true });
    return () => {
      for (const event of events) window.removeEventListener(event, activate);
    };
  }, [interacted]);
  return interacted ? <JapaneseFontFace /> : null;
}
