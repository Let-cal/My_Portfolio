import { MapPinIcon } from "lucide-react";
import { LocalTime } from "@/components/fx/LocalTime";

export type AvailabilityStatusProps = {
  openToWork: boolean;
  availabilityNote: string;
  location: string;
  labels: { openToWork: string; localTime: string };
};

/**
 * Open-to-work badge (hidden when false, with the pulsing dot only under no-preference motion) and the city
 * with the live local time. Shared by the hero status card and the contact section. Server-compatible.
 */
export function AvailabilityStatus({ openToWork, availabilityNote, location, labels }: AvailabilityStatusProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {openToWork && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span aria-hidden="true" className="relative flex size-2.5">
            <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="font-semibold">{labels.openToWork}</span>
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
        <span className="sr-only">{labels.localTime}</span>
        <LocalTime className="font-mono text-foreground" />
      </p>
    </div>
  );
}
