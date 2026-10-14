import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitch } from "@/components/site/LanguageSwitch";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { Button } from "@/components/ui/button";
import type { Content, Locale, RoleKey } from "@/content/schema";
import { DEFAULT_ROLE } from "@/lib/roles";
import { buildQuickData } from "@/lib/quick";
import { PrintButton } from "./PrintButton";
import { QuickMarkScript } from "./quick-mark";
import { QuickViewMarker } from "./QuickViewMarker";

const SECTION_HEADING =
  "border-b border-border pb-1 font-heading text-xs font-semibold tracking-[0.14em] text-brand-text uppercase print:text-[8.5pt]";
const LINK =
  "rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * The 60-second view: one A4 page for a recruiter. Name, the title of the chosen role, summary, the first four
 * experiences for that role (one line each), skill groups, four certificates, education and contact. A server
 * component; the Print button is the only client script it adds. On screen it is a sheet on the site background;
 * in print the site chrome is gone (globals.css) and the sheet fills the page in dark-on-white.
 *
 * It is the page's only top-level element and carries `data-quick-view`. QuickMarkScript (first paint) and
 * QuickViewMarker (client navigations) mark `<html data-quick>`, which globals.css uses to hide the site chrome
 * around it. Do not import anything from src/scene here.
 */
export function QuickView({ content, locale, role }: { content: Content; locale: Locale; role: RoleKey }) {
  const t = useTranslations();
  const d = buildQuickData(content, locale, role);
  const home = `/${locale}${role === DEFAULT_ROLE ? "" : `?role=${role}`}`;

  return (
    <main id="main" data-quick-view="" className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10 print:max-w-none print:p-0">
      <QuickMarkScript />
      <QuickViewMarker />
      <div role="toolbar" aria-label={t("quick.toolsLabel")} className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        {/* A plain link on purpose: a full page load brings the site chrome back (see globals.css). */}
        <Button asChild variant="ghost">
          <a href={home}>
            <ArrowLeftIcon aria-hidden="true" />
            {t("quick.back")}
          </a>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitch />
          <ThemeToggle />
          {d.cvFileUrl && (
            <Button asChild>
              <a href={d.cvFileUrl} download>
                <DownloadIcon aria-hidden="true" />
                {t("hero.downloadCv")}
              </a>
            </Button>
          )}
          <PrintButton label={t("quick.print")} />
        </div>
      </div>

      <article
        aria-labelledby="quick-name"
        className="flex flex-col gap-6 rounded-2xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm sm:p-10 print:gap-5 print:rounded-none print:border-0 print:bg-transparent print:p-0 print:text-[10pt] print:leading-snug print:shadow-none print:backdrop-blur-none"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 id="quick-name" className="font-heading text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl print:text-[24pt]">
              {d.name}
            </h1>
            <p id="quick-title" className="mt-1 font-mono text-sm text-brand-text sm:text-base print:text-[10pt]">
              {d.roleTitle}
            </p>
          </div>
          {d.openToWork && (
            <p className="inline-flex max-w-xs items-start gap-2 self-start rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground print:max-w-[60mm] print:px-2 print:py-1 print:text-[8pt]">
              <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--role-accent)]" />
              <span>
                <span className="block font-medium text-foreground">{t("hero.openToWork")}</span>
                {d.availabilityNote}
              </span>
            </p>
          )}
        </div>

        <ul aria-label={t("quick.contactLabel")} className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground print:text-[9pt]">
          <li>{d.location}</li>
          <li>
            <a className={LINK} href={`mailto:${d.email}`}>
              {d.email}
            </a>
          </li>
          <li>
            <a className={LINK} href={d.linkedin.href}>
              {d.linkedin.label}
            </a>
          </li>
          <li>
            <a className={LINK} href={d.github.href}>
              {d.github.label}
            </a>
          </li>
        </ul>

        <p className="text-base leading-relaxed text-pretty print:text-[10.5pt]">{d.summary}</p>

        <section aria-labelledby="quick-experience" className="flex flex-col gap-2">
          <h2 id="quick-experience" className={`${SECTION_HEADING} flex flex-wrap justify-between gap-x-4`}>
            {t("quick.keyExperience")}
            {d.employer && <span className="font-sans tracking-normal text-muted-foreground normal-case">{d.employer}</span>}
          </h2>
          <ol className="flex flex-col gap-1.5">
            {d.experiences.map((e) => (
              <li key={e.id} data-quick-experience="" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <p className="min-w-0 flex-1">
                  <span className="font-semibold">{e.company}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {e.position}
                    {e.parentCompany ? ` · ${e.parentCompany}` : ""}
                  </span>
                </p>
                <span className="shrink-0 text-muted-foreground tabular-nums">{e.period}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="quick-skills" className="flex flex-col gap-2">
          <h2 id="quick-skills" className={SECTION_HEADING}>
            {t("sections.skills")}
          </h2>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] print:grid-cols-[26mm_minmax(0,1fr)] print:gap-y-0.5">
            {d.skillGroups.map((g) => (
              <div key={g.group} className="contents">
                <dt className="font-semibold">{t(`skills.groups.${g.group}`)}</dt>
                <dd className="mb-1.5 text-muted-foreground sm:mb-0">{g.names.join(" · ")}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2 print:gap-5">
          <section aria-labelledby="quick-certificates" className="flex flex-col gap-2">
            <h2 id="quick-certificates" className={SECTION_HEADING}>
              {t("sections.certificates")}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {d.certificates.map((c) => (
                <li key={c.id} data-quick-certificate="">
                  <span className="font-semibold">{c.name}</span>
                  <span className="block text-muted-foreground">
                    {c.organization} · {c.year}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {d.education && (
            <section aria-labelledby="quick-education" className="flex flex-col gap-2">
              <h2 id="quick-education" className={SECTION_HEADING}>
                {t("experience.education")}
              </h2>
              <p>
                <span className="font-semibold">{d.education.school}</span>
                <span className="block text-muted-foreground">{[d.education.degree, d.education.major].filter(Boolean).join(" · ")}</span>
                <span className="block text-muted-foreground">
                  {[d.education.period, d.education.gpa ? t("experience.gpa", { gpa: d.education.gpa }) : "", d.education.notes]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </p>
            </section>
          )}
        </div>
      </article>
    </main>
  );
}
