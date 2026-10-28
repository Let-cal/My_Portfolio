/**
 * The `?kind=` filter of the project archive (`/[locale]/projects`). Client-safe: no content or message bundles.
 *
 * Rows are always rendered; which ones show is decided by CSS from `data-archive-filter` on the rows' wrapper, so a
 * shared `?kind=work` link can be applied by a tiny inline script before the first paint (no flash of every row, no
 * layout shift), and the page still lists every project without JavaScript.
 */
export const ARCHIVE_KINDS = ["all", "work", "university", "personal"] as const;
export type ArchiveKind = (typeof ARCHIVE_KINDS)[number];

/** Reads a `?kind=` value; anything unknown (or missing) is "all". */
export function parseKind(q: string | null | undefined): ArchiveKind {
  return (ARCHIVE_KINDS as readonly string[]).includes(q ?? "")
    ? (q as ArchiveKind)
    : "all";
}

/**
 * The filter a page load starts with: `?kind=` from `search`, except when `hash` targets a row that this kind would
 * hide (a deep link from the skills evidence, `#row-<id>`): then "all", so the linked row is shown and can be
 * scrolled to. `kindOfRow` returns the kind of the row with that element id, or null when there is none.
 */
export function initialKind(
  search: string,
  hash: string,
  kindOfRow: (id: string) => string | null,
): ArchiveKind {
  const kind = parseKind(new URLSearchParams(search).get("kind"));
  if (kind === "all") return kind;
  let id = "";
  try {
    id = decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return kind;
  }
  const target = id ? kindOfRow(id) : null;
  return target && target !== kind ? "all" : kind;
}

/** Attribute on the wrapper of the rows that holds the active filter; each row carries `data-archive-kind`. */
export const FILTER_ATTR = "data-archive-filter";

const FILTERED = ARCHIVE_KINDS.filter((k) => k !== "all");

/**
 * Hides the rows the active filter leaves out, and shows the "nothing of this kind" row of an empty kind. Unlayered
 * on purpose so it wins over the responsive utilities of the rows.
 */
export const ARCHIVE_FILTER_CSS =
  FILTERED.map(
    (k) =>
      `[${FILTER_ATTR}="${k}"] [data-archive-kind]:not([data-archive-kind="${k}"])`,
  ).join(",") +
  "{display:none}[data-archive-empty]{display:none}" +
  FILTERED.map(
    (k) => `[${FILTER_ATTR}="${k}"] [data-archive-empty="${k}"]`,
  ).join(",") +
  "{display:table-row}";

/**
 * `initialKind` for the server HTML, run inline right after the table so the filter of a shared link is in place
 * before the first paint. Keep it in step with `initialKind` (a unit test runs both on the same URLs).
 */
export const ARCHIVE_FILTER_SCRIPT = `(function(){try{var k=new URLSearchParams(location.search).get("kind");if(k!=="work"&&k!=="university"&&k!=="personal")return;var w=document.querySelector("[data-archive-rows]");if(!w)return;var h="";try{h=decodeURIComponent(location.hash.slice(1))}catch(e){}var r=h&&document.getElementById(h),t=r&&r.getAttribute("data-archive-kind");if(t&&t!==k)return;w.setAttribute("${FILTER_ATTR}",k)}catch(e){}})()`;
