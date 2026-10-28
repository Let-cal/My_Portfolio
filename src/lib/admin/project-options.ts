// Choices the admin offers for a project's place in the experience tree and for why-card evidence.
// Plain functions over content, so server pages build them and tests check them against the seed.
import type {
  Content,
  Education,
  Experience,
  Project,
  RoleKey,
} from "@/content/schema";
import { featuredProjects } from "@/lib/featured";
import { companyName, journeyAnchors } from "@/lib/journey";
import { formatPeriod } from "./list-view";

/** The role switcher's Vietnamese labels (messages/vi.json `roles`), for the role tag checkboxes. */
export const ROLE_LABELS: Record<RoleKey, string> = {
  fullstack: "Full-stack",
  techlead: "Tech Lead",
  pm: "Quản lý dự án",
};

/** How the admin names each kind of project (derived from where it belongs, never chosen). */
export const KIND_LABELS: Record<Project["kind"], string> = {
  work: "Công việc",
  university: "Đại học",
  personal: "Cá nhân",
};

export type Choice = { value: string; label: string };
export type WhereOptions = {
  /** Stints grouped by company (parent company, else company), newest company and stint first. */
  companies: { name: string; stints: Choice[] }[];
  schools: Choice[];
};

const hiddenMark = (item: { published?: boolean }) =>
  item.published === false ? " (đang ẩn)" : "";

/** The "Thuộc về" choices: every stint (hidden ones marked) by company, then every school. */
export function whereOptions(
  experiences: Experience[],
  education: Education[],
): WhereOptions {
  const groups = new Map<string, Experience[]>();
  for (const e of experiences) {
    const name = companyName(e);
    groups.set(name, [...(groups.get(name) ?? []), e]);
  }
  const newest = (a: Experience, b: Experience) =>
    b.start.localeCompare(a.start) || a.sortIndex - b.sortIndex;
  const companies = [...groups]
    .map(([name, stints]) => ({ name, stints: [...stints].sort(newest) }))
    .sort((a, b) => newest(a.stints[0], b.stints[0]))
    .map(({ name, stints }) => ({
      name,
      stints: stints.map((s) => ({
        value: `exp:${s.id}`,
        label: `${s.position.en} · ${formatPeriod(s.start, s.end)}${hiddenMark(s)}`,
      })),
    }));
  return {
    companies,
    schools: education.map((e) => ({ value: `edu:${e.id}`, label: e.school })),
  };
}

type Where = Pick<Project, "experienceId" | "educationId" | "kind">;

/** The select value for a project's links: `exp:<id>`, `edu:<id>` or `personal`. */
export function whereValue(p: {
  experienceId?: unknown;
  educationId?: unknown;
}): string {
  if (typeof p.experienceId === "string" && p.experienceId)
    return `exp:${p.experienceId}`;
  if (typeof p.educationId === "string" && p.educationId)
    return `edu:${p.educationId}`;
  return "personal";
}

/** The three fields a "Thuộc về" choice sets together, so kind always matches the link. */
export function applyWhere(value: string): Where {
  if (value.startsWith("exp:"))
    return { experienceId: value.slice(4), educationId: null, kind: "work" };
  if (value.startsWith("edu:"))
    return {
      experienceId: null,
      educationId: value.slice(4),
      kind: "university",
    };
  return { experienceId: null, educationId: null, kind: "personal" };
}

export type EvidenceGroup = { label: string; options: Choice[] };

/**
 * Anchors a why card can point to, as they exist on the site now (the same rule health uses): tree parents
 * `#exp-<group slug>`, tree children `#tree-<projectId>`, and `#proj-<id>` for projects with a home card.
 */
export function evidenceOptions(
  c: Pick<Content, "experiences" | "education" | "projects">,
): EvidenceGroup[] {
  const anchors = journeyAnchors(c as Content);
  const parents = new Map<string, string>();
  for (const e of c.experiences) {
    const anchor = anchors.experiences.get(e.id);
    if (anchor && !parents.has(anchor)) parents.set(anchor, companyName(e));
  }
  for (const e of c.education) {
    const anchor = anchors.education.get(e.id);
    if (anchor && !parents.has(anchor)) parents.set(anchor, e.school);
  }
  const title = new Map(c.projects.map((p) => [p.id, p.title]));
  return [
    {
      label: "Cây kinh nghiệm: công ty, trường",
      options: [...parents].map(([anchor, name]) => ({
        value: `#${anchor}`,
        label: name,
      })),
    },
    {
      label: "Cây kinh nghiệm: dự án",
      options: [...anchors.projects].map(([id, anchor]) => ({
        value: `#${anchor}`,
        label: title.get(id) ?? id,
      })),
    },
    {
      label: "Thẻ dự án trên trang chủ",
      options: featuredProjects(c.projects).map((p) => ({
        value: `#proj-${p.id}`,
        label: p.title,
      })),
    },
  ];
}
