import { cacheLife } from "next/cache";

/**
 * Today, read inside a cache scope so a prerendered page may use it (Cache Components reject a bare `new Date()`
 * while prerendering). Open-ended spans (durations, the Gantt) count up to this month; it refreshes daily.
 */
export async function cachedNow(): Promise<Date> {
  return new Date(await nowIso());
}

async function nowIso(): Promise<string> {
  "use cache";
  cacheLife("days");
  return new Date().toISOString();
}
