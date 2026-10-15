import { smoothstep } from "./math";

/** Shared world coordinates: geometry and water highlights must agree in both themes. */
export const GARDEN_LAMPS = [
  [-4.5, 2.4], [4.8, -0.8], [-4.2, -3.7],
] as const;
export const GARDEN_CELESTIAL = [-10, 13, -32] as const;

/** One continuous garden, fully established before the waterfall camera arrives. */
export function gardenWeight(position: number): number {
  return smoothstep(1.25, 2, position) * (1 - smoothstep(3.3, 4, position));
}

/** Sky joins once the view tilts up; no new sky over the preceding top-down pond. */
export function gardenSkyWeight(position: number): number {
  return smoothstep(2.15, 2.8, position) * (1 - smoothstep(3.3, 4, position));
}
