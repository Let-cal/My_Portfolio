"use client";

import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { DEFAULT_ROLE } from "@/lib/roles";
import { LanguageSwitch } from "./LanguageSwitch";
import { useRole } from "./RoleProvider";
import { SECTION_IDS } from "./sections";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const t = useTranslations();
  const { role } = useRole();
  const [menuOpen, setMenuOpen] = useState(false);

  // Keep the chosen role when jumping to a section.
  const query = role === DEFAULT_ROLE ? "" : `?role=${role}`;
  const sectionHref = (id: string) => `/${query}#${id}`;

  const openCommand = () => window.dispatchEvent(new Event("open-command"));

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href={sectionHref("hero")}
          aria-label={t("header.home")}
          className="font-heading text-lg font-bold tracking-[0.18em] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          LET<span className="text-brand-text">CAL</span>
        </Link>

        <nav aria-label={t("header.primaryNav")} className="ml-4 hidden items-center gap-1 lg:flex">
          {SECTION_IDS.map((id) => (
            <Link
              key={id}
              href={sectionHref(id)}
              className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t(`nav.${id}`)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <LanguageSwitch />
          <ThemeToggle />
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t("header.openCommand")}
            onClick={openCommand}
            className="hidden sm:inline-flex"
          >
            <kbd className="font-sans text-xs text-muted-foreground">⌘K</kbd>
          </Button>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="lg:hidden" aria-label={t("header.openMenu")}>
                <MenuIcon aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetTitle className="p-4 pb-0">{t("header.primaryNav")}</SheetTitle>
              <SheetDescription className="sr-only">{t("header.primaryNav")}</SheetDescription>
              <nav aria-label={t("header.primaryNav")} className="flex flex-col gap-1 px-2">
                {SECTION_IDS.map((id) => (
                  <Link
                    key={id}
                    href={sectionHref(id)}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-md px-3 py-2.5 text-base text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {t(`nav.${id}`)}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto p-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setMenuOpen(false);
                    openCommand();
                  }}
                >
                  {t("header.openCommand")} <kbd className="font-sans text-xs text-muted-foreground">⌘K</kbd>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
