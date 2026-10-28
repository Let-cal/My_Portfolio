import type { Project } from "@/content/schema";

/** Home bento shows at most this many projects; the admin refuses a 4th star. */
export const FEATURED_LIMIT = 3;

/** Shown in the admin when a 4th star is attempted (the admin UI is Vietnamese). */
export const STAR_LIMIT_MESSAGE =
  "Đã có 3 dự án nổi bật. Bỏ sao một dự án khác trước.";

/** Newest start first; ties keep the owner's manual order, then id, so the result is stable. */
export function newestFirst(
  a: Pick<Project, "start" | "sortIndex" | "id">,
  b: Pick<Project, "start" | "sortIndex" | "id">,
): number {
  return (
    b.start.localeCompare(a.start) ||
    a.sortIndex - b.sortIndex ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Projects for the home bento: published starred projects by `featuredOrder` (a star without an order comes
 * last), cut to `limit`; when fewer than `limit` are starred the rest is filled with the newest published
 * projects (by `start`, newest first). More than `limit` stars already in the data (e.g. edited via SQL) show
 * the first `limit` by order. Never mutates its input.
 */
export function featuredProjects(
  projects: Project[],
  limit: number = FEATURED_LIMIT,
): Project[] {
  const published = projects.filter((p) => p.published);
  const starred = published
    .filter((p) => p.featured)
    .sort(
      (a, b) =>
        (a.featuredOrder ?? Number.POSITIVE_INFINITY) -
          (b.featuredOrder ?? Number.POSITIVE_INFINITY) || newestFirst(a, b),
    )
    .slice(0, limit);
  if (starred.length >= limit) return starred;
  const taken = new Set(starred.map((p) => p.id));
  const fill = published
    .filter((p) => !taken.has(p.id))
    .sort(newestFirst)
    .slice(0, limit - starred.length);
  return [...starred, ...fill];
}

/**
 * Why `id` may not be starred right now, or null when it may. Removing a star, or re-saving a project that is
 * already starred, is never refused. Counts every starred row (published or not): the limit is on the data.
 */
export function starRefusal(
  projects: Pick<Project, "id" | "featured">[],
  id: string,
): string | null {
  const target = projects.find((p) => p.id === id);
  if (target?.featured) return null;
  const starred = projects.filter((p) => p.featured).length;
  return starred >= FEATURED_LIMIT ? STAR_LIMIT_MESSAGE : null;
}
