"use client";

import dynamic from "next/dynamic";

/**
 * Vercel Speed Insights, loaded after hydration in its own chunk so it is not part of the first page's JavaScript.
 * Its web-vitals observers read buffered entries, so starting a moment later loses no measurement.
 */
const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((m) => m.SpeedInsights),
  { ssr: false },
);

export function DeferredSpeedInsights() {
  return <SpeedInsights />;
}
