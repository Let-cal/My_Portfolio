"use client";

import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { DEFAULT_ROLE } from "@/lib/roles";
import { useRole } from "./RoleProvider";

/** True on `/<locale>` itself, where the section anchors live. */
const HOME = /^\/[a-z]{2}\/?$/;
/** True on the all-projects page, `/<locale>/projects`. */
const ARCHIVE = /^\/[a-z]{2}\/projects\/?$/;

/**
 * Where the site navigation points. On the home page a section link stays an in-page `#id` (smooth scrolling, the
 * query kept as is); on another page (the project archive, the 60-second view) it loads the home page at that
 * section, keeping the chosen role. Also tells whether the current page is the project archive.
 */
export function useSiteLinks(): {
  sectionHref: (id: string) => string;
  archiveHref: string;
  onArchive: boolean;
} {
  const pathname = usePathname() ?? "";
  const locale = useLocale();
  const { role } = useRole();
  const onHome = HOME.test(pathname);
  const query = role === DEFAULT_ROLE ? "" : `?role=${role}`;
  return {
    sectionHref: (id) => (onHome ? `#${id}` : `/${locale}${query}#${id}`),
    archiveHref: `/${locale}/projects`,
    onArchive: ARCHIVE.test(pathname),
  };
}
