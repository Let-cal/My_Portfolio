"use client";

import { useSyncExternalStore } from "react";

const REFRESH_MS = 30_000;
const PLACEHOLDER = "--:--";

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, REFRESH_MS);
  return () => clearInterval(timer);
}

function formatTime(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")} (${get("timeZoneName")})`;
}

/**
 * Local time of the portfolio owner as `HH:mm (GMT+7)`, refreshed every 30 s.
 * The server (and hydration pass) renders a fixed-width placeholder, so there is no hydration mismatch.
 */
export function LocalTime({ timeZone = "Asia/Ho_Chi_Minh", className }: { timeZone?: string; className?: string }) {
  const label = useSyncExternalStore(
    subscribe,
    () => formatTime(timeZone),
    () => PLACEHOLDER,
  );
  return <span className={className ? `tabular-nums ${className}` : "tabular-nums"}>{label}</span>;
}
