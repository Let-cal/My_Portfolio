"use client";

import { useSyncExternalStore } from "react";

const REFRESH_MS = 30_000;

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, REFRESH_MS);
  return () => clearInterval(timer);
}

function parts(timeZone: string) {
  const list = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  }).formatToParts(new Date());
  const get = (type: string) => list.find((p) => p.type === type)?.value ?? "";
  return { time: `${get("hour")}:${get("minute")}`, offset: get("timeZoneName") };
}

const formatTime = (timeZone: string) => {
  const { time, offset } = parts(timeZone);
  return `${time} (${offset})`;
};
/** Same shape and length as the real label (`HH:mm (GMT+7)`), so hydration does not change the width. */
const formatPlaceholder = (timeZone: string) => `--:-- (${parts(timeZone).offset})`;

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
