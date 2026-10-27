import type {
  Content,
  Education,
  Experience,
  Link,
  Locale,
  Project,
  RoleKey,
} from "@/content/schema";
import type { CaseStudyView } from "@/components/sections/experience/CaseStudySheet";
import { formatPeriod } from "@/lib/format";
import { pickLocale } from "@/lib/i18n-text";

export type JourneyChild = {
  id: string;
  /** DOM id of the child card: `tree-<projectId>`. */
  anchor: string;
  title: string;
  role: string;
  period: string;
  summary: string;
  tech: string[];
  teamSize: string | null;
  links: Link[];
  caseStudy: CaseStudyView | null;
  roles: RoleKey[];
};

export type JourneyParent = {
  /** Unique within the journey: `company:<group key>` or `school:<education id>`. */
  key: string;
  /** DOM id of the parent row: `exp-<slug of the group key>`. */
  anchor: string;
  kind: "company" | "school";
  name: string;
  location: string | null;
  period: string;
  /** Stints (company) or the degree (school), newest first, one line each. */
  lines: { title: string; period: string }[];
  summary: string | null;
  /** Grade average of a school as entered ("7.66/10"); null for companies. */
  gpa: string | null;
  tech: string[];
  children: JourneyChild[];
  /** "N projects" when there are children, "internship" for an all-internship company without any, else none. */
  chip: { count: number } | { label: "internship" } | null;
};

/**
 * Slug of a parent's group key, used in `#exp-<slug>`. Deterministic rule: drop a trailing or inner
 * parenthesised part, strip accents (NFKD), lowercase, turn every run of non-[a-z0-9] into one `-`, trim `-`.
 * "SKG Software (Splus)" -> "skg-software", "FPT University" -> "fpt-university". Returns null when nothing
 * is left (e.g. a name written only in Japanese); the caller then falls back to the first stint's id.
 */
export function groupSlug(name: string): string | null {
  const slug = name
    .replace(/\([^)]*\)/g, " ")
    .replace(/[đĐ]/g, "d")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? null : slug;
}

/** Sorts so an open-ended (null) end comes first, then the later end; shared by parents and spans. */
const endKey = (end: string | null) => end ?? "9999-99";

function span(items: { start: string; end: string | null }[]): {
  start: string;
  end: string | null;
} {
  const start = items.map((i) => i.start).sort()[0];
  const ends = items.map((i) => i.end);
  const end = ends.includes(null)
    ? null
    : ((ends as string[]).sort().at(-1) ?? null);
  return { start, end };
}

/** Distinct, non-empty values in first-seen order. */
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

function childOf(
  p: Project,
  locale: Locale,
  t: (key: string) => string,
): JourneyChild {
  const repos = p.repoUrls.map((url, i) => ({
    label: p.repoUrls.length === 1 ? t("code") : `${t("code")} ${i + 1}`,
    url,
  }));
  return {
    id: p.id,
    anchor: `tree-${p.id}`,
    title: p.title,
    role: pickLocale(p.role, locale),
    period: formatPeriod(p.start, p.end, locale),
    summary: pickLocale(p.summary, locale),
    tech: p.tech,
    teamSize: p.teamSize,
    links: [
      ...(p.demoUrl ? [{ label: t("demo"), url: p.demoUrl }] : []),
      ...repos,
      ...p.links,
    ],
    caseStudy: p.caseStudy && {
      problem: pickLocale(p.caseStudy.problem, locale),
      role: pickLocale(p.caseStudy.role, locale),
      decisions: pickLocale(p.caseStudy.decisions, locale),
      result: pickLocale(p.caseStudy.result, locale),
    },
    roles: p.roles,
  };
}

const newestStart = (a: { start: string }, b: { start: string }) =>
  b.start.localeCompare(a.start);

/**
 * The Experience tree: one parent per company (stints grouped by `parentCompany`, otherwise `company`) and one
 * per school, each with the work / university projects that belong to it.
 *
 * - Parents by latest end (open-ended first); children by start, newest first.
 * - Only published stints and projects. A project whose stint is unpublished, or whose school is missing, is
 *   left out of the tree (it still lives on `/projects` when it is itself published). Personal projects never
 *   appear here.
 * - Every text goes through `pickLocale`, so an empty JA/VI field shows the EN text.
 * - `t` supplies the link labels ("code", "demo") from the `projects` namespace.
 */
export function buildJourney(
  content: Content,
  locale: Locale,
  t: (key: string) => string,
): JourneyParent[] {
  const projects = content.projects.filter((p) => p.published);

  const childrenFor = (match: (p: Project) => boolean) =>
    projects
      .filter(match)
      .sort((a, b) => newestStart(a, b) || a.sortIndex - b.sortIndex)
      .map((p) => childOf(p, locale, t));

  // Companies: published stints grouped by parent company, otherwise by company.
  const groups = new Map<string, Experience[]>();
  for (const e of content.experiences) {
    if (!e.published) continue;
    const key = e.parentCompany || e.company;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const companies = [...groups].map(([name, unsorted]) => {
    const stints = [...unsorted].sort(
      (a, b) =>
        newestStart(a, b) ||
        endKey(b.end).localeCompare(endKey(a.end)) ||
        a.sortIndex - b.sortIndex,
    );
    const ids = new Set(stints.map((s) => s.id));
    const children = childrenFor(
      (p) =>
        p.kind === "work" && p.experienceId !== null && ids.has(p.experienceId),
    );
    const { start, end } = span(stints);
    const summary = unique(stints.map((s) => pickLocale(s.summary, locale)));
    const parent: JourneyParent = {
      key: `company:${name}`,
      anchor: `exp-${groupSlug(name) ?? stints[0].id}`,
      kind: "company",
      name,
      location: stints[0].location,
      period: formatPeriod(start, end, locale),
      lines: stints.map((s) => ({
        title: pickLocale(s.position, locale),
        period: formatPeriod(s.start, s.end, locale),
      })),
      summary: summary.length > 0 ? summary.join("\n\n") : null,
      gpa: null,
      tech: unique(stints.flatMap((s) => s.tech)),
      children,
      chip:
        children.length > 0
          ? { count: children.length }
          : stints.every((s) => s.employmentType === "internship")
            ? { label: "internship" }
            : null,
    };
    return { parent, end, start };
  });

  const schools = content.education.map((e: Education) => {
    const children = childrenFor(
      (p) => p.kind === "university" && p.educationId === e.id,
    );
    const notes = e.notes ? pickLocale(e.notes, locale) : "";
    const period = formatPeriod(e.start, e.end, locale);
    const parent: JourneyParent = {
      key: `school:${e.id}`,
      anchor: `exp-${groupSlug(e.school) ?? e.id}`,
      kind: "school",
      name: e.school,
      location: null,
      period,
      lines: [
        {
          title: unique([
            pickLocale(e.degree, locale),
            pickLocale(e.major, locale),
          ]).join(" · "),
          period,
        },
      ],
      summary: notes || null,
      gpa: e.gpa,
      tech: [],
      children,
      chip: children.length > 0 ? { count: children.length } : null,
    };
    return { parent, end: e.end, start: e.start };
  });

  return [...companies, ...schools]
    .sort(
      (a, b) =>
        endKey(b.end).localeCompare(endKey(a.end)) ||
        newestStart(a, b) ||
        a.parent.name.localeCompare(b.parent.name),
    )
    .map((x) => x.parent);
}
