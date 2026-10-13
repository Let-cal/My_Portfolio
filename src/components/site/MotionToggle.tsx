"use client";

import { PauseIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useMotionPreference } from "./motion-preference";

/**
 * Switches page motion on and off. It shows the effective state (pressed = motion on) and flips it, which also
 * overrides an OS "reduce motion" setting; the visitor's choice lives in localStorage (see motion-preference.ts).
 */
export function MotionToggle() {
  const t = useTranslations("motion");
  const { reduced, setPref } = useMotionPreference();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("label")}
      aria-pressed={!reduced}
      onClick={() => setPref(reduced ? "on" : "off")}
    >
      {/* CSS picks the icon from <html data-motion> so the right one shows before hydration (no flash). */}
      <SparklesIcon className="motion-reduce:hidden" aria-hidden />
      <PauseIcon className="hidden motion-reduce:block" aria-hidden />
    </Button>
  );
}
