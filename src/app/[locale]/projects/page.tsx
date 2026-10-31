import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "@/components/site/icons";
import { ProjectArchive } from "@/components/sections/projects/ProjectArchive";
import { routing } from "@/i18n/routing";
import {
  archiveMetadata,
  archiveRows,
  groupByYear,
  yearSpan,
} from "@/lib/archive";
import {
  ARCHIVE_FILTER_CSS,
  ARCHIVE_FILTER_SCRIPT,
} from "@/lib/archive-filter";
import { cachedNow } from "@/lib/data/cached-now";
import { getContent } from "@/lib/data/get-content";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return archiveMetadata(locale);
}

/**
 * `/[locale]/projects`: every published project in filterable year groups (spec 5.3), under a summary line
 * ("8 projects · 2023 – 2026"). The page is prerendered per locale from the cached content; `?kind=` is applied on
 * the client (an inline script before the first paint, then the archive component), so the shell never waits on
 * request data.
 */
export default async function ProjectsPage({
  params,
}: PageProps<"/[locale]/projects">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("archive");
  const content = await getContent();
  const now = await cachedNow();
  const rows = archiveRows(content, locale, now);
  const years = yearSpan(rows);

  return (
    <main
      id="main"
      className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-24 sm:px-6 lg:pt-24"
    >
      <style dangerouslySetInnerHTML={{ __html: ARCHIVE_FILTER_CSS }} />
      {/* A plain anchor, as on the home page: a full load keeps the home page's scroll restoration and scene startup simple. */}
      <a
        href={`/${locale}#projects`}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArrowLeftIcon className="size-4" />
        {t("back")}
      </a>
      <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
        {t("title")}
      </h1>
      {years ? (
        <p className="mt-3 font-medium text-foreground tabular-nums">
          {t("summary", { count: rows.length, years })}
        </p>
      ) : null}
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("intro")}</p>
      <ProjectArchive groups={groupByYear(rows)} />
      {/* After the rows: it reads them to keep a #row- deep link visible. */}
      <script dangerouslySetInnerHTML={{ __html: ARCHIVE_FILTER_SCRIPT }} />
    </main>
  );
}
