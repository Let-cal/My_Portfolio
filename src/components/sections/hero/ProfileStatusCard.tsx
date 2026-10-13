"use client";

import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { MagneticButton } from "@/components/fx/MagneticButton";
import { AvailabilityStatus } from "@/components/site/AvailabilityStatus";
import { useRole } from "@/components/site/RoleProvider";
import { useCopyEmail } from "@/components/site/use-copy-email";
import { Button } from "@/components/ui/button";
import type { RoleKey } from "@/content/schema";

export type ProfileStatusCardProps = {
  openToWork: boolean;
  availabilityNote: string;
  location: string;
  email: string;
  cvUrls: Record<RoleKey, string>;
};

/**
 * ID-card style status: open-to-work badge (hidden when false), city with the live local time, Copy email
 * (confirmed inline and by a toast) and the CV of the chosen role. Never shows a phone number.
 */
export function ProfileStatusCard({ openToWork, availabilityNote, location, email, cvUrls }: ProfileStatusCardProps) {
  const t = useTranslations("hero");
  const { role } = useRole();
  const { copied, copy } = useCopyEmail(email, t("status.copied"));

  return (
    <section
      aria-label={t("status.label")}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between"
    >
      <AvailabilityStatus
        openToWork={openToWork}
        availabilityNote={availabilityNote}
        location={location}
        labels={{ openToWork: t("openToWork"), localTime: t("status.localTime") }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-10 px-4" onClick={copy}>
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
