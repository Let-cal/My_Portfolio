"use client";

import { DownloadIcon, MailIcon, TimerIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRole } from "@/components/site/RoleProvider";
import { RoleSwitcher } from "@/components/site/RoleSwitcher";
import type { Locale, RoleKey } from "@/content/schema";

export type HeroRoleData = { title: string; summary: string; cvFileUrl: string };

/**
 * The role-dependent half of the Hero: title, summary and CTAs. The static HTML shows the default role;
 * the `?role=` value is applied right after hydration (see RoleProvider).
 */
export function HeroRole({ roles, locale }: { roles: Record<RoleKey, HeroRoleData>; locale: Locale }) {
  const t = useTranslations("hero");
  const { role } = useRole();
  const current = roles[role];

  return (
    <>
      <p className="mt-4 font-heading text-xl font-medium text-brand-text sm:text-2xl">{current.title}</p>
      <div className="mt-6">
        <RoleSwitcher />
      </div>
      <p aria-live="polite" className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        {current.summary}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg" className="h-11 px-5 text-base">
          <a href={current.cvFileUrl} download>
            <DownloadIcon aria-hidden />
            {t("downloadCv")}
          </a>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-11 px-5 text-base">
          <a href="#contact">
            <MailIcon aria-hidden />
            {t("contact")}
          </a>
        </Button>
        <Button asChild variant="ghost" size="lg" className="h-11 px-5 text-base">
          <Link href={`/${locale}/quick?role=${role}`}>
            <TimerIcon aria-hidden />
            {t("quickView")}
          </Link>
        </Button>
      </div>
    </>
  );
}
