import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { MailIcon } from "@/components/site/icons";
import type { RoleKey } from "@/content/schema";
import "./ink-thread.css";
import {
  ArchiveLink,
  ChapterLink,
  InkThread,
  RoleTitle,
} from "./SideRailClient";
import { SECTION_CHAPTERS, SECTION_IDS } from "./sections";

export type SideRailProps = {
  name: string;
  /** Localized job title of each role; the one of the chosen role is shown. */
  titles: Record<RoleKey, string>;
  links: { github: string; linkedin: string; email: string };
  icons: { github: ReactNode; linkedin: ReactNode };
};

/**
 * Sticky left column (desktop, 1024px and up): name, the title of the chosen role, the chapter navigation and the
 * contact icons. The navigation is the 墨の糸 ink thread (Emaki spec 5.5): a kanji numeral per chapter on one thin
 * swaying line, inked down to the reader's position, with a progress hairline under each label and a peek card on
 * hover or focus. "All projects" is a dashed spur off the thread. Section links are in-page `#id` links; on another
 * page the project archive sends them to the home page (no code for that ships here).
 *
 * This is a server component: only the active chapter, the archive check and the role title are client islands
 * (`SideRailClient`), and the thread engine (`ink-thread.ts`) loads when the browser is idle.
 */
export function SideRail({ name, titles, links, icons }: SideRailProps) {
  const t = useTranslations();
  const locale = useLocale();

  const socials = [
    { label: t("footer.github"), href: links.github, icon: icons.github },
    { label: t("footer.linkedin"), href: links.linkedin, icon: icons.linkedin },
    {
      label: t("footer.email"),
      href: `mailto:${links.email}`,
      icon: <MailIcon className="size-5" />,
    },
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
          <p
            data-scene-avoid=""
            className="mt-3 font-[family-name:var(--font-serif)] text-xl text-balance text-brand-text italic [&:lang(ja)]:not-italic"
          >
            <RoleTitle titles={titles} />
          </p>

          <nav
            aria-label={t("header.primaryNav")}
            data-scene-avoid=""
            className="mt-14"
          >
            <InkThread className="it">
              <svg
                data-ink-svg=""
                className="it-svg it-base"
                width="20"
                height="0"
                aria-hidden="true"
                focusable="false"
              >
                <path data-ink-path="" />
              </svg>
              <svg
                data-ink-svg=""
                data-ink=""
                className="it-svg it-ink"
                width="20"
                height="0"
                aria-hidden="true"
                focusable="false"
              >
                <defs>
                  <linearGradient
                    id="it-ink-gradient"
                    data-ink-gradient=""
                    gradientUnits="userSpaceOnUse"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop data-ink-stop="" className="it-stop-role" />
                    <stop data-ink-stop="" className="it-stop-teal" />
                  </linearGradient>
                </defs>
                <path data-ink-path="" stroke="url(#it-ink-gradient)" />
              </svg>
              <span data-ink-drop="" className="it-drop" aria-hidden="true" />
              <ul data-ink-list="" className="it-list">
                {SECTION_IDS.map((id) => (
                  <li key={id}>
                    <ChapterLink id={id} className="it-link">
                      <span
                        data-numeral=""
                        aria-hidden="true"
                        lang="ja"
                        className="it-numeral"
                      >
                        {SECTION_CHAPTERS[id].numeral}
                      </span>
                      <span className="it-label">{t(`nav.${id}`)}</span>
                      <span
                        data-progress=""
                        aria-hidden="true"
                        className="it-progress"
                      >
                        <span />
                      </span>
                      <span data-peek="" aria-hidden="true" className="it-peek">
                        <b lang="ja">{SECTION_CHAPTERS[id].kanji}</b>
                        {t(`nav.peek.${id}`)}
                      </span>
                    </ChapterLink>
                    {id === "projects" ? (
                      <ArchiveLink
                        href={`/${locale}/projects`}
                        className="it-spur"
                      >
                        {t("archive.nav")}
                        <span aria-hidden="true" className="it-arrow">
                          ↗
                        </span>
                      </ArchiveLink>
                    ) : null}
                  </li>
                ))}
              </ul>
            </InkThread>
          </nav>
        </div>

        <ul
          aria-label={t("footer.links")}
          data-scene-avoid="box"
          className="flex items-center gap-5"
        >
          {socials.map(({ label, href, icon }) => (
            <li key={label}>
              <a
                href={href}
                aria-label={label}
                {...(href.startsWith("http")
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
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
