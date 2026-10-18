import type { CSSProperties } from "react";
import type { RoleKey } from "@/content/schema";

export const ROLE_IMAGE: Record<RoleKey, string> = {
  fullstack: "/images/roles/role-developer.webp",
  techlead: "/images/roles/role-techlead.webp",
  pm: "/images/roles/role-pm.webp",
};
// The portrait sits inside the ring (85.45% of its width), not across the full wheel.
export const ROLE_PORTRAIT_SIZES = "(min-width: 1024px) 376px, (min-width: 450px) 308px, 68.36vw";
export type PortraitProps = { src: string; srcSet?: string; sizes?: string; style?: CSSProperties; decoding?: "async" | "sync" | "auto" };
export type RolePortraits = Record<RoleKey, PortraitProps>;
