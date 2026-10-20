"use client";

import {
  AwardIcon,
  BriefcaseIcon,
  FolderKanbanIcon,
  HeartIcon,
  HouseIcon,
  MailIcon,
  WrenchIcon,
  type LucideIcon,
} from "@/components/site/icons";
import * as motion from "motion/react-m";
import { useTranslations } from "next-intl";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";
import { clsx } from "clsx";
import { SECTION_IDS, type SectionId } from "./sections";
import { useActiveSection } from "./use-active-section";

const ICONS: Record<SectionId, LucideIcon> = {
  hero: HouseIcon,
  experience: BriefcaseIcon,
  projects: FolderKanbanIcon,
  skills: WrenchIcon,
  certificates: AwardIcon,
  why: HeartIcon,
  contact: MailIcon,
};

/**
 * Frosted-glass pill floating at the bottom of the screen below 1024px: an icon and a short label per
 * section. The highlight behind the active item is one shared element (`layoutId`) that glides between items.
 */
export function PillNav() {
  const t = useTranslations();
  const reduced = usePrefersReducedMotion();
  const active = useActiveSection();

  return (
    <nav
      aria-label={t("header.primaryNav")}
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-full border border-border bg-background p-1 shadow-lg lg:hidden"
    >
      <ul className="flex items-stretch">
        {SECTION_IDS.map((id) => {
          const Icon = ICONS[id];
          const current = active === id;
          return (
            <li key={id} className="min-w-0 flex-1">
              <a
                href={`#${id}`}
                aria-current={current ? "true" : undefined}
                className={clsx(
                  "relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-full px-0.5 text-[10px] leading-none font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  current ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {current && (
                  <motion.span
                    layoutId="pill-active"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--role-accent, #f97316) 24%, transparent)",
                    }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 34 }
                    }
                  />
                )}
                <Icon aria-hidden="true" className="relative size-[18px]" />
                <span className="relative max-w-full truncate tracking-tight">
                  {t(`pill.${id}`)}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
