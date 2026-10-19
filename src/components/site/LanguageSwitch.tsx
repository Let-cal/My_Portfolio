"use client";

import { useLocale, useTranslations } from "next-intl";
import { localizedPath } from "@/lib/localized-path";
import { routing } from "@/i18n/routing";
import { clsx } from "clsx";
import { cn } from "@/lib/utils";

/**
 * Switches the locale with a full page load. With `cacheComponents` a soft navigation keeps the previous
 * locale's page in the DOM (hidden), which duplicates every section id and leaves its effects mounted.
 * The query string (`?role=`) and the hash are read at click time from `window.location`, so the
 * switcher never has to suspend on `useSearchParams`.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const t = useTranslations("language");
  const current = useLocale();

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn("flex items-center gap-0.5", className)}
    >
      {routing.locales.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-label={`${locale.toUpperCase()} · ${t(locale)}`}
            aria-current={active ? "true" : undefined}
            onClick={() => {
              if (active) return;
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full page load, see above
              window.location.assign(
                `${localizedPath(window.location.pathname, locale)}${window.location.search}${window.location.hash}`,
              );
            }}
            className={clsx(
              "rounded-md px-1.5 py-1 text-xs font-medium uppercase tracking-wide transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "bg-muted text-brand-text"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
