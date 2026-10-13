import { useTranslations } from "next-intl";
import { ROLE_KEYS, type Content, type Experience as ExperienceRecord, type Locale, type RoleKey } from "@/content/schema";
import { formatPeriod } from "@/lib/format";
import { pickLocale } from "@/lib/i18n-text";
import { orderExperiences } from "@/lib/roles";
import { Timeline, type CompanyView, type TimelineData, type TimelineItem } from "./experience/Timeline";

/** Parent company whose header carries the two position lines (intern, then engineer). From the CV fact bank. */
const SKG = "SKG Software (Splus)";
const SKG_LINES = [
  { messageKey: "skgIntern", start: "2025-08", end: "2025-10" },
  { messageKey: "skgEngineer", start: "2025-10", end: "2026-09" },
] as const;

/** Earliest start to latest end of a group; open-ended as soon as one member is. */
function spanOf(exps: ExperienceRecord[]): { start: string; end: string | null } {
  const start = exps.map((e) => e.start).sort()[0];
  const ends = exps.map((e) => e.end);
  const end = ends.includes(null) ? null : (ends as string[]).sort().at(-1) ?? null;
  return { start, end };
}

/**
 * Experience section. Builds localized view-models (one copy of the items, plus the id order of each role) and hands
 * them to the client Timeline, which picks the order of the current role. No other locale's text is shipped.
 */
export function Experience({ content, locale }: { content: Content; locale: Locale }) {
  const t = useTranslations("experience");
  const ts = useTranslations("sections");
  const { experiences, roles, education } = content;

  const published = experiences.filter((e) => e.published);
  const orders = Object.fromEntries(
    ROLE_KEYS.map((key) => {
      const role = roles.find((r) => r.key === key);
      const ordered = role ? orderExperiences(published, role) : [...published].sort((a, b) => a.sortIndex - b.sortIndex);
      return [key, ordered.map((e) => e.id)];
    }),
  ) as Record<RoleKey, string[]>;

  const items = Object.fromEntries(
    published.map((e): [string, TimelineItem] => [
      e.id,
      {
        id: e.id,
        company: e.company,
        parentCompany: e.parentCompany,
        position: pickLocale(e.position, locale),
        period: formatPeriod(e.start, e.end, locale),
        summary: pickLocale(e.summary, locale),
        tech: e.tech,
        teamSize: e.teamSize,
        links: e.links,
        caseStudy: e.caseStudy && {
          problem: pickLocale(e.caseStudy.problem, locale),
          role: pickLocale(e.caseStudy.role, locale),
          decisions: pickLocale(e.caseStudy.decisions, locale),
          result: pickLocale(e.caseStudy.result, locale),
        },
      },
    ]),
  );

  const companies: Record<string, CompanyView> = {};
  for (const name of new Set(published.map((e) => e.parentCompany).filter((n): n is string => n !== null))) {
    const span = spanOf(published.filter((e) => e.parentCompany === name));
    companies[name] = {
      name,
      period: formatPeriod(span.start, span.end, locale),
      lines:
        name === SKG
          ? SKG_LINES.map((line) => ({ title: t(line.messageKey), period: formatPeriod(line.start, line.end, locale) }))
          : [],
    };
  }

  const data: TimelineData = {
    items,
    orders,
    companies,
    education: [...education]
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map((e) => ({
        id: e.id,
        school: e.school,
        degree: pickLocale(e.degree, locale),
        major: pickLocale(e.major, locale),
        period: formatPeriod(e.start, e.end, locale),
        gpa: e.gpa,
        notes: e.notes ? pickLocale(e.notes, locale) : null,
      })),
  };

  return (
    <section
      id="experience"
      aria-labelledby="experience-heading"
      className="relative mx-auto max-w-6xl scroll-mt-14 px-4 py-24 sm:px-6"
    >
      <h2 id="experience-heading" className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
        {ts("experience")}
      </h2>
      <div className="mt-10">
        <Timeline data={data} />
      </div>
    </section>
  );
}
