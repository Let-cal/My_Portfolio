import type { KoiVariety, RoleKey } from "@/content/schema";
import type { Tier } from "../tier";

const VARIETY_BY_ROLE: Record<RoleKey, KoiVariety> = {
  fullstack: "kohaku",
  techlead: "showa",
  pm: "ogon",
};

/** Full-stack swims as a Kohaku, Tech Lead as a Showa, Technical PM as an Ogon. */
export function varietyForRole(role: RoleKey): KoiVariety {
  return VARIETY_BY_ROLE[role] ?? "kohaku";
}

export type CreatureQuality = {
  /** Rings along the spine. */
  rings: number;
  /** Vertices around each ring. */
  sides: number;
};

export function qualityForTier(tier: Exclude<Tier, "off">): CreatureQuality {
  return tier === "high" ? { rings: 110, sides: 28 } : { rings: 72, sides: 18 };
}

/**
 * Per-variety surface: how shiny the skin is (Ogon is a metallic koi) and the fin tint. Fin tints are kept dark:
 * a lit fin near white would swallow its orange emissive rim after tone mapping.
 */
export const VARIETY_SURFACE: Record<
  KoiVariety,
  { metalness: number; roughness: number; fin: string }
> = {
  kohaku: { metalness: 0.1, roughness: 0.34, fin: "#8a837c" },
  showa: { metalness: 0.12, roughness: 0.32, fin: "#86807a" },
  ogon: { metalness: 0.6, roughness: 0.24, fin: "#94692a" },
};

/** How far (world units) the farthest point of the cloud flies from the body at full scatter: `aRand * scatter * 1.6`. */
export const SCATTER_SPREAD = 1.6;
