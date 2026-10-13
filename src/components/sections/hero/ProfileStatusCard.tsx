"use client";

import { CheckIcon, CopyIcon, DownloadIcon, MapPinIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LocalTime } from "@/components/fx/LocalTime";
import { MagneticButton } from "@/components/fx/MagneticButton";
import { useRole } from "@/components/site/RoleProvider";
import { Button } from "@/components/ui/button";
import type { RoleKey } from "@/content/schema";

export type ProfileStatusCardProps = {
  openToWork: boolean;
  availabilityNote: string;
  location: string;
  email: string;
  cvUrls: Record<RoleKey, string>;
};

const COPIED_MS = 2000;

/**
 * ID-card style status: open-to-work badge (hidden when false), city with the live local time, Copy email
 * (confirmed inline and by a toast) and the CV of the chosen role. Never shows a phone number.
 */
export function ProfileStatusCard({ openToWork, availabilityNote, location, email, cvUrls }: ProfileStatusCardProps) {
  const t = useTranslations("hero");
  const { role } = useRole();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      toast(t("status.copied"), { description: email });
    } catch {
      // No clipboard (insecure context, denied permission): fall back to the mail client.
      window.location.href = `mailto:${email}`;
    }
  }

  return (
    <section
      aria-label={t("status.label")}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-2">
        {openToWork && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span aria-hidden="true" className="relative flex size-2.5">
              <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="font-semibold">{t("openToWork")}</span>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <span className="text-muted-foreground">{availabilityNote}</span>
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <MapPinIcon aria-hidden="true" className="size-4 shrink-0" />
          <span>{location}</span>
          <span aria-hidden="true">·</span>
          <span className="sr-only">{t("status.localTime")}</span>
          <LocalTime className="font-mono text-foreground" />
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-10 px-4" onClick={copyEmail}>
          {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
          <span aria-live="polite">{copied ? t("status.copied") : t("status.copyEmail")}</span>
        </Button>
        {cvUrls[role] && (
          <MagneticButton asChild>
            <Button asChild className="h-10 px-4">
              <a href={cvUrls[role]} download>
                <DownloadIcon aria-hidden="true" />
                {t("downloadCv")}
              </a>
            </Button>
          </MagneticButton>
        )}
      </div>
    </section>
  );
}
