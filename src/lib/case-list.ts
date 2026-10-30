/** Where a case study panel was opened from; decides the chapter label and which list previous / next walk. */
export type CaseContext = "tree" | "bento" | "archive";

/** Query parameter that deep-links to a case study: `?case=<projectId>`. */
export const CASE_PARAM = "case";

/** Ids of the items that have a case study, in list order. Only these take part in the panel. */
export function caseIds(
  items: { id: string; caseStudy: unknown | null }[],
): string[] {
  return items.filter((i) => i.caseStudy).map((i) => i.id);
}

/**
 * The position of `id` in `ids` and its previous / next ids. The list is circular when it holds more than one
 * id; with a single id (or when `id` is not in the list) both neighbours are null, and an unknown id has
 * `index` -1.
 */
export function neighbours(
  ids: string[],
  id: string,
): { prev: string | null; next: string | null; index: number; total: number } {
  const total = ids.length;
  const index = ids.indexOf(id);
  if (index === -1 || total < 2)
    return { prev: null, next: null, index, total };
  return {
    prev: ids[(index - 1 + total) % total],
    next: ids[(index + 1) % total],
    index,
    total,
  };
}

/** The `?case=` id of a query string, only when it is one of `known`; otherwise null. */
export function parseCaseParam(
  search: string,
  known: ReadonlySet<string>,
): string | null {
  const id = new URLSearchParams(search).get(CASE_PARAM);
  return id !== null && known.has(id) ? id : null;
}
