"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/site/theme";

/** Light/dark switch for the admin; shares the site's stored preference. */
export function AdminThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {/* CSS picks the icon so the right one shows before hydration. */}
      <Sun aria-hidden className="hidden size-4 dark:block" />
      <Moon aria-hidden className="size-4 dark:hidden" />
    </Button>
  );
}
