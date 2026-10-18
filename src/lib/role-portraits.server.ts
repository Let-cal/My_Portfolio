import portraits from "@/content/role-portraits.json";
import type { RolePortraits } from "./role-portraits";

/** Pre-encoded responsive assets; no request-time optimizer or client image runtime. */
export function getRolePortraits(): RolePortraits {
  return portraits as RolePortraits;
}
