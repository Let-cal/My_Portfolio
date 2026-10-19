"use client";

import { DownloadIcon } from "@/components/site/icons";
import { useLocale, useTranslations } from "next-intl";
import { MagneticButton } from "@/components/fx/MagneticButton";
import { Button } from "@/components/ui/button";
import type { RoleKey } from "@/content/schema";
import { DEFAULT_ROLE } from "@/lib/roles";
import { LanguageSwitch } from "./LanguageSwitch";
import { useRole } from "./RoleProvider";
import { MotionToggle } from "./MotionToggle";
import { SoundToggle } from "./SoundToggle";
import { ThemeToggle } from "./ThemeToggle";
import { useShortcutHint } from "./use-shortcut-hint";

/**
 * Top bar. Below 1024px it is a slim full-width bar (logo and quick controls; the section links live in the
 * bottom pill nav). From 1024px the side rail carries the name and the section links, so the header shrinks
 * to a small floating cluster in the top-right corner: language, theme, sound, command palette, CV download.
 */
export function Header({ cvUrls }: { cvUrls: Record<RoleKey, string> }) {
  const t = useTranslations();
  const locale = useLocale();
  const { role } = useRole();
  const shortcut = useShortcutHint();

  // Keep the chosen role when going back to the top.
  const query = role === DEFAULT_ROLE ? "" : `?role=${role}`;
  const openCommand = () => window.dispatchEvent(new Event("open-command"));

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background lg:inset-x-auto lg:top-4 lg:right-4 lg:rounded-full lg:border lg:shadow-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6 lg:h-11 lg:max-w-none lg:gap-1 lg:pr-2 lg:pl-3">
        <a
          href={`/${locale}${query}#hero`}
          aria-label={t("header.home")}
          className="font-heading text-lg font-bold tracking-[0.18em] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
        >
          LET<span className="text-brand-text">CAL</span>
        </a>

        <div className="ml-auto flex items-center gap-1 sm:gap-2 lg:ml-0 lg:gap-1">
          <LanguageSwitch />
          <ThemeToggle />
          <MotionToggle />
          <SoundToggle />
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t("header.openCommand")}
            onClick={openCommand}
            className="hidden sm:inline-flex"
          >
            <kbd className="font-sans text-xs text-muted-foreground">
              {shortcut}
            </kbd>
          </Button>
          {cvUrls[role] && (
            <MagneticButton asChild>
              <Button asChild size="sm" className="ml-1 hidden lg:inline-flex">
                <a href={cvUrls[role]} download>
                  <DownloadIcon aria-hidden />
                  {t("hero.downloadCv")}
                </a>
              </Button>
            </MagneticButton>
          )}
        </div>
      </div>
    </header>
  );
}
