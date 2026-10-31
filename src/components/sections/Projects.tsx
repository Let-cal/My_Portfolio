import { useTranslations } from "next-intl";
import type { CaseStudyItem } from "@/components/sections/case-study/CaseStudyPanel";
import type { Content, Locale } from "@/content/schema";
import { archiveRows } from "@/lib/archive";
import { caseItemFromRow } from "@/lib/case-items";
import { featuredProjects } from "@/lib/featured";
import { formatPeriod } from "@/lib/format";
import { pickLocale } from "@/lib/i18n-text";
import { repoLinks } from "@/lib/repo-links";
import { ProjectsBento, type ProjectView } from "./projects/ProjectsBento";
import { ProjectCardBody } from "./projects/ProjectCardBody";
import { Reveal } from "@/components/site/Reveal";

/** Up to three letters for the placeholder tile: word initials ("Meet My Lecturer" -> MML) or camel-case capitals ("SitePlus" -> SP). */
function initialsOf(title: string): string {
  const words = title.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const letters =
    words.length > 1
      ? words.map((w) => w[0])
      : (words[0]?.match(/\p{Lu}/gu) ?? [words[0]?.[0] ?? "?"]);
  return letters.slice(0, 3).join("").toUpperCase();
}

/**
 * Projects section. Builds localized view-models for the featured projects (the starred ones in order, filled with
 * the newest published when fewer than three are starred) and hands them to the client bento grid, which owns hover
 * video previews and the case study panel. A link below the grid goes to the page with every published project.
 * `now` is the month an open-ended project's duration runs up to (a cached date on the prerendered page).
 */
export function Projects({
  content,
  locale,
  now,
}: {
  content: Content;
  locale: Locale;
  now?: Date;
}) {
  const t = useTranslations("projects");
  const ts = useTranslations("sections");
  const ta = useTranslations("archive");

  const projects = featuredProjects(content.projects).map((p): ProjectView => ({
    id: p.id,
    title: p.title,
    initials: initialsOf(p.title),
    role: pickLocale(p.role, locale),
    period: formatPeriod(p.start, p.end, locale),
    summary: pickLocale(p.summary, locale),
    tech: p.tech,
    demoUrl: p.demoUrl,
    repos: repoLinks(p.repoUrls, t),
    posterUrl: p.posterUrl,
    videoUrl: p.videoUrl,
    hasCaseStudy: Boolean(p.caseStudy),
  }));
  const total = content.projects.filter((p) => p.published).length;
  const rows = new Map(
    archiveRows(content, locale, now).map((row) => [row.id, row]),
  );
  const caseItems = projects.flatMap((p): CaseStudyItem[] => {
    const row = rows.get(p.id);
    const item = row && caseItemFromRow(row, ta(`kinds.${row.whereKind}`));
    return item ? [item] : [];
  });

  return (
    <section
      id="projects"
      aria-labelledby="projects-heading"
      className="relative mx-auto max-w-6xl scroll-mt-14 px-4 py-24 sm:px-6"
    >
      <Reveal>
        <h2
          id="projects-heading"
          data-scene-avoid=""
          className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {ts("projects")}
        </h2>
      </Reveal>
      <div className="mt-10">
        <ProjectsBento
          projects={projects}
          caseItems={caseItems}
          bodies={Object.fromEntries(
            projects.map((project, index) => [
              project.id,
              <ProjectCardBody
                key={project.id}
                project={project}
                index={index}
                featured={index === 0}
              />,
            ]),
          )}
        />
      </div>
      {/* A plain anchor: next/link would add a client chunk past the initial-JS budget for a link that needs no client navigation. */}
      <p className="mt-8 flex justify-center md:justify-end">
        <a
          href={`/${locale}/projects`}
          className="group/all inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card/60 px-5 text-sm font-medium backdrop-blur-md transition-colors hover:border-brand-400/60 hover:bg-card/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("viewAll", { count: total })}
          <span
            aria-hidden="true"
            className="transition-transform group-hover/all:translate-x-0.5 motion-reduce:transition-none"
          >
            →
          </span>
        </a>
      </p>
    </section>
  );
}
