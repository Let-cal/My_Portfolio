"use client";

import { MailIcon } from "@/components/site/icons";
import { useTranslations } from "next-intl";
import { TextScramble } from "@/components/fx/TextScramble";
import type { RoleKey } from "@/content/schema";
import { clsx } from "clsx";
import { useRole } from "./RoleProvider";
import { SECTION_IDS } from "./sections";
import type { ReactNode } from "react";
import { useActiveSection } from "./use-active-section";

export type SideRailProps = {
  name: string;
  /** Localized job title of each role; the one of the chosen role is shown. */
  titles: Record<RoleKey, string>;
  links: { github: string; linkedin: string; email: string };
  icons: { github: ReactNode; linkedin: ReactNode };
};

const ACCENT = "var(--role-accent, #f97316)";

/**
 * Sticky left column (desktop, 1024px and up): name, the title of the chosen role, the seven section links
 * and the contact icons. Each link has a 32px line; the section crossing the reading line gets a 64px line
 * in the role accent colour and `aria-current`.
 */
export function SideRail({ name, titles, links, icons }: SideRailProps) {
  const t = useTranslations();
  const { role } = useRole();
  const active = useActiveSection();

  const socials = [
    { label: t("footer.github"), href: links.github, icon: icons.github },
    { label: t("footer.linkedin"), href: links.linkedin, icon: icons.linkedin },
    { label: t("footer.email"), href: `mailto:${links.email}`, icon: <MailIcon className="size-5" /> },
  ];

  return (
    <aside className="relative z-20 hidden lg:block">
      <div className="sticky top-0 flex h-svh flex-col justify-between px-8 py-12 xl:px-12 xl:py-16">
        <div>
          <a
            href="#hero"
            data-scene-avoid=""
            className="block rounded-sm font-heading text-3xl leading-tight font-bold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50 xl:text-4xl"
          >
            {name}
          </a>
          <p data-scene-avoid="" className="mt-3 font-[family-name:var(--font-serif)] text-xl text-balance text-brand-text italic [&:lang(ja)]:not-italic">
            <TextScramble text={titles[role]} />
          </p>

          <nav aria-label={t("header.primaryNav")} data-scene-avoid="" className="mt-14">
            <ul className="flex flex-col gap-1">
              {SECTION_IDS.map((id) => {
                const current = active === id;
                return (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      aria-current={current ? "true" : undefined}
                      className={clsx(
                        "group flex items-center gap-4 rounded-sm py-2 text-xs font-semibold tracking-[0.18em] uppercase outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        current ? "text-foreground" : "text-muted-foreground hover:text-foreground focus-visible:text-foreground",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={clsx(
                          "h-px shrink-0 bg-current transition-[width] duration-300 ease-out group-hover:w-16 group-focus-visible:w-16 motion-reduce:transition-none",
                          current ? "w-16" : "w-8",
                        )}
                        style={current ? { backgroundColor: ACCENT } : undefined}
                      />
                      {t(`nav.${id}`)}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <ul aria-label={t("footer.links")} data-scene-avoid="box" className="flex items-center gap-5">
          {socials.map(({ label, href, icon }) => (
            <li key={label}>
              <a
                href={href}
                aria-label={label}
                {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="block rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {icon}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
