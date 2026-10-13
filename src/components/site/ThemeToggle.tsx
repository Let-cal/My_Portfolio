"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useTheme } from "./theme";

export function ThemeToggle() {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={theme === "dark" ? t("toLight") : t("toDark")}
      onClick={() => setTheme(next)}
    >
      {/* CSS picks the icon so the right one shows before hydration (no flash). */}
      <SunIcon className="hidden dark:block" aria-hidden />
      <MoonIcon className="dark:hidden" aria-hidden />
    </Button>
  );
}
