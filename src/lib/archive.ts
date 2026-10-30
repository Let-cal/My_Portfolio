import type { Metadata } from "next";
import type { CaseStudyView } from "@/components/sections/experience/CaseStudySheet";
import type {
  Content,
  Link,
  Locale,
  ProjectKind,
  RoleKey,
} from "@/content/schema";
import { newestFirst } from "@/lib/featured";
import { formatPeriod } from "@/lib/format";
import { pickLocale } from "@/lib/i18n-text";
import { companyName, stintShortLabel } from "@/lib/journey";
import { buildPageMetadata } from "@/lib/metadata";
import { OG_IMAGE } from "@/lib/og-image";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import vi from "@/messages/vi.json";

export { parseKind } from "@/lib/archive-filter";

const ARCHIVE = { en: en.archive, ja: ja.archive, vi: vi.archive };

/** One row of the `/[locale]/projects` table, every text already picked for the locale. */
export type ArchiveRow = {
  id: string;
  /** Year the project started, "2026". */
  year: string;
  title: string;
  /** Company group (parent company, else company) for work, the school for university, "Personal" otherwise. */
  where: string;
  whereKind: ProjectKind;
  /** Short label of the stint a work project belongs to ("Intern", "Software Engineer"); null otherwise. */
  stintLabel: string | null;
  role: string;
  period: string;
  tech: string[];
  demoUrl: string | null;
  repoUrls: string[];
  /** Extra labelled links (after the demo and the repos). */
  links: Link[];
  teamSize: string | null;
  /** Starred for the home page. */
  featured: boolean;
  /** Roles this project is evidence for; the role switcher highlights these rows. */
  roles: RoleKey[];
  caseStudy: CaseStudyView | null;
};

/**
 * Every published project, newest start first (ties: the owner's manual order, then id), for the archive table.
 * Unlike the Experience tree, a project is listed even when its stint is unpublished; "where" still names the
 * company. Texts fall back to EN through `pickLocale`.
 */
export function archiveRows(content: Content, locale: Locale): ArchiveRow[] {
  const stints = new Map(content.experiences.map((e) => [e.id, e]));
  const schools = new Map(content.education.map((e) => [e.id, e]));
  return content.projects
    .filter((p) => p.published)
    .sort(newestFirst)
    .map((p): ArchiveRow => {
      const stint = p.experienceId ? stints.get(p.experienceId) : undefined;
      const school = p.educationId ? schools.get(p.educationId) : undefined;
      const where =
        p.kind === "work"
          ? stint
            ? companyName(stint)
            : ""
          : p.kind === "university"
            ? (school?.school ?? "")
            : ARCHIVE[locale].personal;
      return {
        id: p.id,
        year: p.start.slice(0, 4),
        title: p.title,
        where,
        whereKind: p.kind,
        stintLabel:
          p.kind === "work" && stint ? stintShortLabel(stint, locale) : null,
        role: pickLocale(p.role, locale),
        period: formatPeriod(p.start, p.end, locale),
        tech: p.tech,
        demoUrl: p.demoUrl,
        repoUrls: p.repoUrls,
        links: p.links,
        teamSize: p.teamSize,
        featured: p.featured,
        roles: p.roles,
        caseStudy: p.caseStudy && {
          problem: pickLocale(p.caseStudy.problem, locale),
          role: pickLocale(p.caseStudy.role, locale),
          decisions: pickLocale(p.caseStudy.decisions, locale),
          result: pickLocale(p.caseStudy.result, locale),
        },
      };
    });
}

/** Rows split by start year, newest year first; the order inside a year is kept. */
export function groupByYear(
  rows: ArchiveRow[],
): { year: string; rows: ArchiveRow[] }[] {
  const groups = new Map<string, ArchiveRow[]>();
  for (const row of rows)
    groups.set(row.year, [...(groups.get(row.year) ?? []), row]);
  return [...groups]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, yearRows]) => ({ year, rows: yearRows }));
}

/**
 * Title, description, canonical `/<locale>/projects` with its hreflang alternatives, and the share image. A child
 * route that sets its own `openGraph` does not inherit the image file of `[locale]`, so the locale's card is named
 * here for both Open Graph and the large Twitter card.
 */
export function archiveMetadata(locale: Locale): Metadata {
  const metadata = buildPageMetadata(locale, ARCHIVE[locale].description, {
    path: "/projects",
    title: ARCHIVE[locale].metaTitle,
  });
  const images = [
    {
      url: `/${locale}/opengraph-image`,
      width: OG_IMAGE.size.width,
      height: OG_IMAGE.size.height,
      alt: OG_IMAGE.alt,
      type: OG_IMAGE.contentType,
    },
  ];
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, images },
    twitter: { ...metadata.twitter, images },
  };
}
