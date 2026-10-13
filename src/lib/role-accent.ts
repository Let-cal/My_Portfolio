import type { RoleKey } from "@/content/schema";

/** Accent colour of each role, after its koi: Kohaku (full-stack), Showa (tech lead), Ogon (PM). Set as `--role-accent` on <html>. */
export const ROLE_ACCENT: Record<RoleKey, string> = { fullstack: "#e4571e", techlead: "#dc2626", pm: "#e0a84e" };

/**
 * Start angle of each role's 120° slice of the hero wheel, as a CSS angle (0° = top, clockwise):
 * full-stack upper-left, tech lead upper-right, PM at the bottom.
 */
export const SECTOR_FROM: Record<RoleKey, number> = { fullstack: 240, techlead: 0, pm: 120 };

/** Role order around the wheel, clockwise from the top. Arrow keys follow this order. */
export const WHEEL_ORDER: readonly RoleKey[] = ["fullstack", "techlead", "pm"];

const normalize = (deg: number) => ((deg % 360) + 360) % 360;

/** Role whose slice contains the CSS angle `deg` (any value; normalised to [0, 360)). */
export function sectorForAngle(deg: number): RoleKey {
  const a = normalize(deg);
  if (a < 120) return "techlead";
  if (a < 240) return "pm";
  return "fullstack";
}

/** CSS angle (0° = up, clockwise, in [0, 360)) of the point (x, y) seen from the centre (cx, cy). Screen y grows down. */
export function angleFromPoint(x: number, y: number, cx: number, cy: number): number {
  const deg = (Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI;
  return normalize(deg);
}
