import { useTranslations } from "next-intl";
import type { Content, Locale } from "@/content/schema";
import { formatPeriod } from "@/lib/format";
import { pickLocale } from "@/lib/i18n-text";
import { ProjectsBento, type ProjectView } from "./projects/ProjectsBento";
import { Reveal } from "@/components/site/Reveal";

type Translate = ReturnType<typeof useTranslations<"projects">>;

/** Up to three letters for the placeholder tile: word initials ("Meet My Lecturer" -> MML) or camel-case capitals ("SitePlus" -> SP). */
function initialsOf(title: string): string {
  const words = title.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const letters =
    words.length > 1 ? words.map((w) => w[0]) : (words[0]?.match(/\p{Lu}/gu) ?? [words[0]?.[0] ?? "?"]);
  return letters.slice(0, 3).join("").toUpperCase();
}

const MOBILE = /mobile|android|(^|[^a-z])(mb|ios)([^a-z]|$)/i;
const WEB = /(^|[^a-z])(fe|web|frontend)([^a-z]|$)/i;

/** Labels the repos of one project: "Code" for a single one, "Code (Web)" / "Code (Mobile)" when the repo name says which, else "Code 1", "Code 2". */
function repoLinks(urls: string[], t: Translate): { url: string; label: string }[] {
  if (urls.length === 1) return [{ url: urls[0], label: t("code") }];
  const kinds = urls.map((url) => {
    const name = url.split("/").filter(Boolean).at(-1) ?? "";
    return MOBILE.test(name) ? "mobile" : WEB.test(name) ? "web" : null;
  });
  const anyMobile = kinds.includes("mobile");
  const anyWeb = kinds.includes("web");
  return urls.map((url, i) => {
    // A repo with no hint next to a mobile repo is the web one (and the other way round).
    const kind = kinds[i] ?? (anyMobile && !anyWeb ? "web" : anyWeb && !anyMobile ? "mobile" : null);
    const label = kind === "web" ? t("codeWeb") : kind === "mobile" ? t("codeMobile") : t("codeN", { n: i + 1 });
    return { url, label };
  });
}

/**
 * Projects section. Builds localized view-models (published only, in sortIndex order) and hands them to the client
 * bento grid, which owns hover video previews and the case study sheet.
 */
export function Projects({ content, locale }: { content: Content; locale: Locale }) {
  const t = useTranslations("projects");
  const ts = useTranslations("sections");

  const projects = content.projects
    .filter((p) => p.published)
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map(
      (p): ProjectView => ({
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
        caseStudy: p.caseStudy && {
          problem: pickLocale(p.caseStudy.problem, locale),
          role: pickLocale(p.caseStudy.role, locale),
          decisions: pickLocale(p.caseStudy.decisions, locale),
          result: pickLocale(p.caseStudy.result, locale),
        },
      }),
    );

  return (
    <section
      id="projects"
      aria-labelledby="projects-heading"
      className="relative mx-auto max-w-6xl scroll-mt-14 px-4 py-24 sm:px-6"
    >
      <Reveal>
        <h2 id="projects-heading" className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {ts("projects")}
        </h2>
      </Reveal>
      <div className="mt-10">
        <ProjectsBento projects={projects} />
      </div>
    </section>
  );
}
