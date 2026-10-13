"use client";

import { Volume2Icon, VolumeXIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSound } from "@/components/fx/sound";
import { Button } from "@/components/ui/button";

/** Speaker button for the synthesized water sounds. Off by default; the choice lives in localStorage. */
export function SoundToggle() {
  const t = useTranslations("sound");
  const { enabled, setEnabled, play } = useSound();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("label")}
      aria-pressed={enabled}
      onClick={() => {
        setEnabled(!enabled);
        // Only turning on plays the drop, so the sound confirms the change.
        if (!enabled) play("drop");
      }}
    >
      {enabled ? <Volume2Icon aria-hidden /> : <VolumeXIcon aria-hidden />}
    </Button>
  );
}
