import type { Tier } from "./tier";

export type LoadInput = {
  tier: Tier;
  isMobile: boolean;
  /** The visitor has touched, scrolled or pressed a key. */
  interacted: boolean;
  /** Milliseconds of idle time since the page loaded. */
  idleMs: number;
  /** The `load` event has fired and the browser has gone idle. */
  pageLoaded: boolean;
};

export const MOBILE_IDLE_LOAD_MS = 3000;

/**
 * When the heavy 3D chunk may be fetched. `off` never loads it. Desktop waits for the page to finish loading;
 * mobile waits for the first interaction or 3 seconds of idle, so the Lighthouse run never pays for three.js.
 */
export function shouldLoadScene(i: LoadInput): boolean {
  if (i.tier === "off") return false;
  if (!i.isMobile) return i.pageLoaded;
  return i.interacted || i.idleMs >= MOBILE_IDLE_LOAD_MS;
}
