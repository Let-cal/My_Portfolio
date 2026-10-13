import { MapPinIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { ROLE_KEYS, type Content, type Locale, type RoleKey } from "@/content/schema";
import { pickLocale } from "@/lib/i18n-text";
import { HeroRole, type HeroRoleData } from "./HeroRole";

/**
 * First section. The name is the h1 (LCP). Role-dependent parts live in the client component HeroRole,
 * which only receives the three roles' display data. The right half is intentionally empty:
 * it is the water surface where the koi swim (3D canvas behind the page).
 */
export function Hero({ content, locale }: { content: Content; locale: Locale }) {
  const t = useTranslations("hero");
  const { profile, roles } = content;

  const roleData = Object.fromEntries(
    ROLE_KEYS.map((key) => {
      const role = roles.find((r) => r.key === key);
      return [
        key,
        {
          title: pickLocale(role?.title, locale),
          summary: pickLocale(profile.summaries[key], locale),
          cvFileUrl: role?.cvFileUrl ?? "",
        },
      ];
    }),
  ) as Record<RoleKey, HeroRoleData>;

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-6xl scroll-mt-14 items-center px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="grid w-full items-center gap-12 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            {profile.avatarUrl && (
              <Image
                src={profile.avatarUrl}
                alt={t("portraitAlt", { name: profile.name })}
                width={96}
                height={96}
                sizes="(min-width: 640px) 96px, 72px"
                priority={false}
                className="size-[72px] rounded-full object-cover ring-2 ring-brand-400/60 ring-offset-2 ring-offset-background sm:size-24"
              />
            )}
            <div className="flex min-w-0 flex-col items-start gap-2">
              {profile.openToWork && (
                <p className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card/60 py-1.5 pr-3 pl-2.5 text-sm sm:rounded-full sm:py-1 backdrop-blur-md">
                  <span aria-hidden className="relative flex size-2">
                    <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="font-medium whitespace-nowrap">{t("openToWork")}</span>
                  <span aria-hidden className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{pickLocale(profile.availabilityNote, locale)}</span>
                </p>
              )}
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPinIcon aria-hidden className="size-4" />
                {profile.location}
              </p>
            </div>
          </div>

          <h1 id="hero-heading" className="mt-8 text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl lg:text-7xl">
            {profile.name}
          </h1>

          <HeroRole roles={roleData} locale={locale} />
        </div>

        {/* Water surface: left empty on purpose so the koi can swim behind/through it. */}
        <div data-water-zone aria-hidden className="hidden min-h-[24rem] lg:block" />
      </div>
    </section>
  );
}
