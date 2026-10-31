import type {
  Content,
  Education,
  Experience,
  Link,
  Locale,
  Project,
  RoleKey,
} from "@/content/schema";
import type { CaseStudyView } from "@/components/sections/case-study/CaseStudyPanel";
import {
  currentMonth,
  formatDuration,
  formatMonth,
  formatPeriod,
  kanjiYear,
  monthIndex,
  monthsBetween,
  shortTitle,
} from "@/lib/format";
import { pickLocale } from "@/lib/i18n-text";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import vi from "@/messages/vi.json";

export { shortTitle } from "@/lib/format";

const INTERN: Record<Locale, string> = {
  en: en.experience.intern,
  ja: ja.experience.intern,
  vi: vi.experience.intern,
};

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
  /** The raw demo and repository URLs (also in `links`, labelled), for the case study panel's actions. */
  demoUrl: string | null;
  repoUrls: string[];
  caseStudy: CaseStudyView | null;
  roles: RoleKey[];
  /** The localized `caseStudy.result`; null without a case study. */
  result: string | null;
  /** Length of the project, months counted inclusively: "6 mos". */
  duration: string;
  /** Id of the stint a work project belongs to; null for university projects. */
  stintId: string | null;
};

/** One position at a company, with the projects done during it. */
export type JourneyStint = {
  /** The experience id; "" for the guard stint that collects projects whose stint is missing. */
  id: string;
  title: string;
  /** Short position label, or the localized "Intern" for an internship; "" for the guard stint. */
  shortLabel: string;
  period: string;
  duration: string;
  start: string;
  end: string | null;
  employmentType: Experience["employmentType"];
  /** Month label of this stint's start when the next older stint was an internship and this one is not. */
  promotedFrom: string | null;
  children: JourneyChild[];
};

/** The mini Gantt of a company: a month axis, one segment per stint and one bar per project. */
export type Timeline = {
  /** First month of the axis, `YYYY-MM`. */
  start: string;
  months: number;
  /** Labelled ticks: `index` is the month offset from `start`. */
  axis: { label: string; index: number }[];
  /** Stints, newest first. `from` / `to` are fractions in [0, 1] of the axis; an end month counts inclusively. */
  segments: { id: string; label: string; from: number; to: number }[];
  bars: {
    id: string;
    anchor: string;
    title: string;
    from: number;
    to: number;
  }[];
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
  /** Duration of the whole span, months counted inclusively: "1 yr 2 mos". */
  duration: string;
  /** The hanko's text: the year of the span's last month in kanji ("二〇二六"); the year of `now` when open-ended. */
  hankoYear: string;
  /** Companies: the positions, newest first, each with its projects. Schools: empty. */
  stints: JourneyStint[];
  /** "Intern → Software Engineer": the short labels oldest first, only when a promotion exists. */
  summaryLabel: string | null;
  /** Only for a company with at least two projects. */
  timeline: Timeline | null;
  /** Every project, newest first (the flat list the stints split up). */
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

const hankoYearOf = (end: string | null, now: Date) =>
  kanjiYear(end === null ? now.getFullYear() : Number(end.slice(0, 4)));

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

/** Short label of a stint: the localized "Intern" for an internship, else the position up to its first separator. */
export function stintShortLabel(
  stint: Pick<Experience, "employmentType" | "position">,
  locale: Locale,
): string {
  return stint.employmentType === "internship"
    ? INTERN[locale]
    : shortTitle(pickLocale(stint.position, locale));
}

function childOf(
  p: Project,
  locale: Locale,
  t: (key: string) => string,
  now: Date,
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
    demoUrl: p.demoUrl,
    repoUrls: p.repoUrls,
    caseStudy: p.caseStudy && {
      problem: pickLocale(p.caseStudy.problem, locale),
      role: pickLocale(p.caseStudy.role, locale),
      decisions: pickLocale(p.caseStudy.decisions, locale),
      result: pickLocale(p.caseStudy.result, locale),
    },
    roles: p.roles,
    result: p.caseStudy && pickLocale(p.caseStudy.result, locale),
    duration: formatDuration(p.start, p.end, locale, now),
    stintId: p.kind === "work" ? p.experienceId : null,
  };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** The stints of a company with their projects; projects without a matching stint go into a final stint with `id: ""`. */
function stintsOf(
  stints: Experience[],
  children: JourneyChild[],
  locale: Locale,
  now: Date,
): JourneyStint[] {
  const known = new Set(stints.map((s) => s.id));
  const result = stints.map((s, i): JourneyStint => {
    const older = stints[i + 1];
    const promoted =
      older?.employmentType === "internship" &&
      s.employmentType !== "internship";
    return {
      id: s.id,
      title: pickLocale(s.position, locale),
      shortLabel: stintShortLabel(s, locale),
      period: formatPeriod(s.start, s.end, locale),
      duration: formatDuration(s.start, s.end, locale, now),
      start: s.start,
      end: s.end,
      employmentType: s.employmentType,
      promotedFrom: promoted ? formatMonth(s.start, locale) : null,
      children: children.filter((c) => c.stintId === s.id),
    };
  });
  const orphans = children.filter((c) => !c.stintId || !known.has(c.stintId));
  if (orphans.length > 0)
    result.push({
      id: "",
      title: "",
      shortLabel: "",
      period: "",
      duration: "",
      start: "",
      end: null,
      employmentType: "full-time",
      promotedFrom: null,
      children: orphans,
    });
  return result;
}

/** Ticks for the month axis: the first month and then every `ceil(months / 7)`-th, so at most 7 labels. */
function axisOf(start: string, months: number, locale: Locale) {
  const step = Math.max(1, Math.ceil(months / 7));
  const first = monthIndex(start);
  const axis: { label: string; index: number }[] = [];
  for (let index = 0; index < months; index += step) {
    const m = first + index;
    const ym = `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`;
    axis.push({ label: formatMonth(ym, locale), index });
  }
  return axis;
}

function timelineOf(
  range: { start: string; end: string | null },
  stints: JourneyStint[],
  projects: Project[],
  children: JourneyChild[],
  locale: Locale,
  now: Date,
): Timeline {
  const first = monthIndex(range.start);
  const months = monthsBetween(range.start, range.end, now);
  const frac = (start: string, end: string | null) => ({
    from: clamp01((monthIndex(start) - first) / months),
    to: clamp01((monthIndex(end ?? currentMonth(now)) + 1 - first) / months),
  });
  const byId = new Map(projects.map((p) => [p.id, p]));
  return {
    start: range.start,
    months,
    axis: axisOf(range.start, months, locale),
    segments: stints
      .filter((s) => s.id !== "")
      .map((s) => ({ id: s.id, label: s.shortLabel, ...frac(s.start, s.end) })),
    bars: children.map((c) => {
      const p = byId.get(c.id)!;
      return {
        id: c.id,
        anchor: c.anchor,
        title: c.title,
        ...frac(p.start, p.end),
      };
    }),
  };
}

const newestStart = (a: { start: string }, b: { start: string }) =>
  b.start.localeCompare(a.start);

/** Name of the company group a stint belongs to: its parent company, otherwise its own company. */
export const companyName = (e: Pick<Experience, "company" | "parentCompany">) =>
  e.parentCompany || e.company;

/** Published stints grouped by parent company, otherwise by company; each group newest first. */
function companyGroups(content: Content): [string, Experience[]][] {
  const groups = new Map<string, Experience[]>();
  for (const e of content.experiences) {
    if (!e.published) continue;
    const key = companyName(e);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups].map(([name, unsorted]) => [
    name,
    [...unsorted].sort(
      (a, b) =>
        newestStart(a, b) ||
        endKey(b.end).localeCompare(endKey(a.end)) ||
        a.sortIndex - b.sortIndex,
    ),
  ]);
}

const companyAnchor = (name: string, stints: Experience[]) =>
  `exp-${groupSlug(name) ?? stints[0].id}`;
const schoolAnchor = (e: Education) => `exp-${groupSlug(e.school) ?? e.id}`;

/**
 * Where each item lives in the tree, without localizing anything: a published stint maps to its parent's
 * `exp-<slug>`, a school to its `exp-<slug>`, and a project that the tree shows to `tree-<id>`. Projects the tree
 * leaves out (personal, unpublished, or whose stint / school is not shown) are absent.
 */
export function journeyAnchors(content: Content): {
  experiences: Map<string, string>;
  education: Map<string, string>;
  projects: Map<string, string>;
} {
  const experiences = new Map<string, string>();
  for (const [name, stints] of companyGroups(content))
    for (const s of stints) experiences.set(s.id, companyAnchor(name, stints));
  const education = new Map(
    content.education.map((e) => [e.id, schoolAnchor(e)]),
  );
  const projects = new Map<string, string>();
  for (const p of content.projects) {
    if (!p.published) continue;
    const shown =
      (p.kind === "work" &&
        p.experienceId !== null &&
        experiences.has(p.experienceId)) ||
      (p.kind === "university" &&
        p.educationId !== null &&
        education.has(p.educationId));
    if (shown) projects.set(p.id, `tree-${p.id}`);
  }
  return { experiences, education, projects };
}

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
 * - `now` is the month an open-ended span runs up to (durations, timeline); it defaults to today.
 */
export function buildJourney(
  content: Content,
  locale: Locale,
  t: (key: string) => string,
  now: Date = new Date(),
): JourneyParent[] {
  const projects = content.projects.filter((p) => p.published);

  const childrenFor = (match: (p: Project) => boolean) =>
    projects
      .filter(match)
      .sort((a, b) => newestStart(a, b) || a.sortIndex - b.sortIndex)
      .map((p) => childOf(p, locale, t, now));

  const companies = companyGroups(content).map(([name, stints]) => {
    const ids = new Set(stints.map((s) => s.id));
    const children = childrenFor(
      (p) =>
        p.kind === "work" && p.experienceId !== null && ids.has(p.experienceId),
    );
    const { start, end } = span(stints);
    const summary = unique(stints.map((s) => pickLocale(s.summary, locale)));
    const stintList = stintsOf(stints, children, locale, now);
    const promoted = stintList.some((s) => s.promotedFrom !== null);
    const parent: JourneyParent = {
      key: `company:${name}`,
      anchor: companyAnchor(name, stints),
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
      duration: formatDuration(start, end, locale, now),
      hankoYear: hankoYearOf(end, now),
      stints: stintList,
      summaryLabel: promoted
        ? stintList
            .filter((s) => s.id !== "")
            .map((s) => s.shortLabel)
            .reverse()
            .join(" → ")
        : null,
      timeline:
        children.length >= 2
          ? timelineOf(
              { start, end },
              stintList,
              projects,
              children,
              locale,
              now,
            )
          : null,
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
      anchor: schoolAnchor(e),
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
      duration: formatDuration(e.start, e.end, locale, now),
      hankoYear: hankoYearOf(e.end, now),
      stints: [],
      summaryLabel: null,
      timeline: null,
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
