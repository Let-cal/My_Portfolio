import portraits from "@/content/role-portraits.json";
import type { RolePortraits } from "./role-portraits";

/** Generated with Next getImageProps before each build; the image optimizer stays unchanged. */
export function getRolePortraits(): RolePortraits {
  return portraits as RolePortraits;
}
