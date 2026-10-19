// Readable list rows for the admin: a name, a detail line and status flags per item.
import type { AdminContent } from "./health";
import { translationStats } from "./health";
import type { ResourceKey } from "./resources";

export type ListRow = {
  id: string;
  label: string;
  detail: string;
  /** Only lists with a published flag can be hidden. */
  hidden: boolean;
  canHide: boolean;
  missingLocales: ("ja" | "vi")[];
  /** Skills linked to this experience/project; the number of evidence items for a skill. */
  skillCount?: number;
};
export type RowStatus =
  "all" | "visible" | "hidden" | "untranslated" | "no-skills";

const month = (ym: string) => {
  const [y, m] = ym.split("-");
  return m ? `${m}/${y}` : ym;
};
export const formatPeriod = (start: string, end: string | null) =>
  `${month(start)} – ${end ? month(end) : "nay"}`;
export const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return d ? `${d}/${m}/${y}` : iso;
};

const en = (v: unknown) =>
  typeof v === "string" ? v : ((v as { en?: string } | null)?.en ?? "");

function missing(item: unknown): ("ja" | "vi")[] {
  const s = translationStats(item);
  return [
    ...(s.ja < s.total ? ["ja" as const] : []),
    ...(s.vi < s.total ? ["vi" as const] : []),
  ];
}

export function listRows(key: ResourceKey, c: AdminContent): ListRow[] {
  const base = (
    id: string,
    label: string,
    detail: string,
    item: unknown,
    published?: boolean,
  ) => ({
    id,
    label,
    detail,
    hidden: published === false,
    canHide: published !== undefined,
    missingLocales: missing(item),
  });
  switch (key) {
    case "experiences":
      return c.experiences.map((e) => ({
        ...base(
          e.id,
          e.company,
          `${en(e.position)} · ${formatPeriod(e.start, e.end)}`,
          e,
          e.published,
        ),
        skillCount: c.skills.filter((s) => s.experienceIds.includes(e.id))
          .length,
      }));
    case "projects":
      return c.projects.map((p) => ({
        ...base(
          p.id,
          p.title,
          `${en(p.role)} · ${formatPeriod(p.start, p.end)}`,
          p,
          p.published,
        ),
        skillCount: c.skills.filter((s) => s.projectIds.includes(p.id)).length,
      }));
    case "skills":
      return c.skills.map((s) => ({
        ...base(s.id, s.name, s.group, s),
        skillCount: s.experienceIds.length + s.projectIds.length,
      }));
    case "certificates":
      return c.certificates.map((x) =>
        base(
          x.id,
          x.name,
          `${x.organization} · ${formatDate(x.issueDate)}`,
          x,
          x.published,
        ),
      );
    case "activities":
      return c.activities.map((a) =>
        base(a.id, en(a.name), formatDate(a.date), a),
      );
    case "education":
      return c.education.map((e) =>
        base(
          e.id,
          e.school,
          `${en(e.degree)} · ${formatPeriod(e.start, e.end)}`,
          e,
        ),
      );
    case "why_cards":
      return c.whyCards.map((w) => base(w.id, en(w.title), en(w.tag), w));
  }
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();

/** The ids before and after `id` in list order, for the editor's previous/next links. */
export function neighbours(
  ids: string[],
  id: string,
): { prev: string | null; next: string | null } {
  const i = ids.indexOf(id);
  if (i < 0) return { prev: null, next: null };
  return { prev: ids[i - 1] ?? null, next: ids[i + 1] ?? null };
}

export function filterRows(
  rows: ListRow[],
  f: { q: string; status: RowStatus },
): ListRow[] {
  const q = fold(f.q.trim());
  return rows.filter((r) => {
    if (q && !fold(`${r.label} ${r.detail} ${r.id}`).includes(q)) return false;
    switch (f.status) {
      case "visible":
        return !r.hidden;
      case "hidden":
        return r.hidden;
      case "untranslated":
        return r.missingLocales.length > 0;
      case "no-skills":
        return r.skillCount === 0;
      default:
        return true;
    }
  });
}
