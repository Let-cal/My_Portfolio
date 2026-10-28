import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "@/components/site/icons";
import { ProjectArchive } from "@/components/sections/projects/ProjectArchive";
import { routing } from "@/i18n/routing";
import { archiveMetadata, archiveRows } from "@/lib/archive";
import {
  ARCHIVE_FILTER_CSS,
  ARCHIVE_FILTER_SCRIPT,
} from "@/lib/archive-filter";
import { getContent } from "@/lib/data/get-content";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return archiveMetadata(locale);
}

/**
 * `/[locale]/projects`: every published project in one filterable table (spec 5.4). The page is prerendered per
 * locale from the cached content; `?kind=` is applied on the client (an inline script before the first paint, then
 * the table component), so the shell never waits on request data.
 */
export default async function ProjectsPage({
  params,
}: PageProps<"/[locale]/projects">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("archive");
  const content = await getContent();

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
      <p className="mt-3 max-w-2xl text-muted-foreground">{t("intro")}</p>
      <ProjectArchive rows={archiveRows(content, locale)} />
      {/* After the table: it reads the rows to keep a #row- deep link visible. */}
      <script dangerouslySetInnerHTML={{ __html: ARCHIVE_FILTER_SCRIPT }} />
    </main>
  );
}
