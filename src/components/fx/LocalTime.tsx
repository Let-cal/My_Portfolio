"use client";

import { useSyncExternalStore } from "react";

const REFRESH_MS = 30_000;

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, REFRESH_MS);
  return () => clearInterval(timer);
}

const MAX_TIME_ZONES = 16;
const zones = new Map<string, { formatter: Intl.DateTimeFormat; placeholder: string }>();

function parts(formatter: Intl.DateTimeFormat, date: Date) {
  const list = formatter.formatToParts(date);
  const get = (type: string) => list.find((p) => p.type === type)?.value ?? "";
  return { time: `${get("hour")}:${get("minute")}`, offset: get("timeZoneName") };
}

const formatTime = (timeZone: string) => {
  const { time, offset } = parts(zoneData(timeZone).formatter, new Date());
  return `${time} (${offset})`;
};
/**
 * The placeholder reads the offset at a fixed date, not "now": the server (and the prerender) must not read the
 * current time (Next.js cacheComponents rejects `new Date()` there). The live label replaces it after hydration.
 */
const PLACEHOLDER_DATE = new Date(Date.UTC(2026, 0, 1));
function zoneData(timeZone: string) {
  const cached = zones.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "shortOffset",
  });
  const entry = { formatter, placeholder: `--:-- (${parts(formatter, PLACEHOLDER_DATE).offset})` };
  if (zones.size >= MAX_TIME_ZONES) zones.delete(zones.keys().next().value!);
  zones.set(timeZone, entry);
  return entry;
}
/** Same shape and length as the real label (`HH:mm (GMT+7)`), so hydration does not change the width. */
const formatPlaceholder = (timeZone: string) => zoneData(timeZone).placeholder;

/**
 * Local time of the portfolio owner as `HH:mm (GMT+7)`, refreshed every 30 s.
 * The server (and hydration pass) renders `--:-- (GMT+7)`, so there is no hydration mismatch, and the box
 * keeps the label's width (tabular digits + a min-width in ch) so the swap does not shift the layout.
 */
export function LocalTime({ timeZone = "Asia/Ho_Chi_Minh", className }: { timeZone?: string; className?: string }) {
  const label = useSyncExternalStore(
    subscribe,
    () => formatTime(timeZone),
    () => formatPlaceholder(timeZone),
  );
  return (
    <span
      className={`inline-block tabular-nums${className ? ` ${className}` : ""}`}
      style={{ minWidth: `${formatPlaceholder(timeZone).length}ch` }}
    >
      {label}
    </span>
  );
}
