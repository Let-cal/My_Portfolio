"use client";

import { DownloadIcon, MailIcon, TimerIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { MagneticButton } from "@/components/fx/MagneticButton";
import { TextScramble } from "@/components/fx/TextScramble";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";
import { useRole } from "@/components/site/RoleProvider";
import { Button } from "@/components/ui/button";
import type { Locale, RoleKey } from "@/content/schema";

export type HeroRoleData = { title: string; summary: string; cvFileUrl: string };

/**
 * Job title of the chosen role, under the name. A role change scrambles into the new title.
 * The static HTML shows the default role; `?role=` is applied right after hydration (see RoleProvider).
 */
export function HeroRoleTitle({ roles }: { roles: Record<RoleKey, HeroRoleData> }) {
  const { role } = useRole();
  return (
    <p id="hero-title" className="hero-role-title mt-3 min-h-[1.5em] font-mono text-sm sm:text-base">
      <TextScramble text={roles[role].title} />
    </p>
  );
}

/** Summary of the chosen role (200 ms crossfade, both copies share one grid cell so nothing jumps) and the CTAs. */
export function HeroRoleBody({ roles, locale }: { roles: Record<RoleKey, HeroRoleData>; locale: Locale }) {
  const t = useTranslations("hero");
  const { role } = useRole();
  const reduced = usePrefersReducedMotion();
  const current = roles[role];

  return (
    <>
      <div aria-live="polite" className="mt-5 grid">
        <AnimatePresence initial={false}>
          <motion.p
            key={role}
            className="col-start-1 row-start-1 text-base leading-relaxed text-muted-foreground sm:text-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          >
            {current.summary}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {current.cvFileUrl && (
          <MagneticButton asChild>
            <Button asChild size="lg" className="h-11 px-5 text-base">
              <a href={current.cvFileUrl} download>
                <DownloadIcon aria-hidden="true" />
                {t("downloadCv")}
              </a>
            </Button>
          </MagneticButton>
        )}
        <MagneticButton asChild>
          <Button asChild variant="outline" size="lg" className="h-11 px-5 text-base">
            <a href="#contact">
              <MailIcon aria-hidden="true" />
              {t("contact")}
            </a>
          </Button>
        </MagneticButton>
        <Button asChild variant="ghost" size="lg" className="h-11 px-5 text-base">
          <Link href={`/${locale}/quick?role=${role}`}>
            <TimerIcon aria-hidden="true" />
            {t("quickView")}
          </Link>
        </Button>
      </div>
    </>
  );
}
