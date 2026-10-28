"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";
import { ChevronRightIcon } from "@/components/site/icons";
import { useRole } from "@/components/site/RoleProvider";
import type { ArchiveRow } from "@/lib/archive";
import {
  ARCHIVE_KINDS,
  FILTER_ATTR,
  initialKind,
  parseKind,
  type ArchiveKind,
} from "@/lib/archive-filter";
import { repoLinks } from "@/lib/repo-links";
import { cn } from "@/lib/utils";

const CaseStudySheet = dynamic(
  () =>
    import("@/components/sections/experience/CaseStudySheet").then(
      (module) => module.CaseStudySheet,
    ),
  { ssr: false },
);

const MAX_TECH = 4;

/** Rewrites `?kind=` in place (no reload, no scroll), keeping the other params; the hash only when asked. */
function writeKind(kind: ArchiveKind, keepHash: boolean) {
  const params = new URLSearchParams(window.location.search);
  if (kind === "all") params.delete("kind");
  else params.set("kind", kind);
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${keepHash ? window.location.hash : ""}`,
  );
}

function Star({ label }: { label: string }) {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="ml-1.5 inline-block size-3.5 -translate-y-px fill-amber-400 align-baseline"
      >
        <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" />
      </svg>
      <span className="sr-only">, {label}</span>
    </>
  );
}

/**
 * The `/[locale]/projects` archive (mockup A): filter chips (All / Work / University / Personal, with counts) over a
 * table of every published project, Year · Project · Where · Role · Tech · Links. Below 640px each row becomes a
 * stacked item and the column headers stay only for screen readers.
 *
 * - The chips are toggle buttons; the choice goes to `?kind=` with `history.replaceState` (no reload) and survives a
 *   reload. Rows are hidden by CSS from `data-archive-filter` on the wrapper, which the server page's inline script
 *   sets from the URL before the first paint and this component owns afterwards (never rendered by React, so
 *   hydration cannot contradict it).
 * - A `#row-<id>` deep link that the filter would hide resets the filter to "all", then the row scrolls into view.
 * - The role switcher only highlights rows whose roles include it (`data-highlight`); the order never changes.
 * - A project with a case study opens it in the shared sheet from a button over its row (click or Enter).
 */
export function ProjectArchive({ rows }: { rows: ArchiveRow[] }) {
  const t = useTranslations("archive");
  const tp = useTranslations("projects");
  const { role } = useRole();
  const reduced = usePrefersReducedMotion();
  // null until the URL has been read after hydration; the server HTML (and the inline script) cover that moment.
  const [kind, setKind] = useState<ArchiveKind | null>(null);
  const active: ArchiveKind = kind ?? "all";
  const [shown, setShown] = useState<ArchiveRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  const counts = useMemo(() => {
    const result: Record<ArchiveKind, number> = {
      all: rows.length,
      work: 0,
      university: 0,
      personal: 0,
    };
    for (const row of rows) result[row.whereKind] += 1;
    return result;
  }, [rows]);

  const kindOfRow = useMemo(() => {
    const byAnchor = new Map(rows.map((r) => [`row-${r.id}`, r.whereKind]));
    return (id: string) => byAnchor.get(id) ?? null;
  }, [rows]);

  // Never write the attribute before the URL is read: that would undo the inline script's filter for a frame.
  useEffect(() => {
    if (kind) wrapRef.current?.setAttribute(FILTER_ATTR, kind);
  }, [kind]);

  const fromLocation = useCallback(() => {
    const { search, hash } = window.location;
    const next = initialKind(search, hash, kindOfRow);
    setKind(next);
    // A deep link overrode ?kind=: drop it so a reload shows the same thing.
    if (next !== parseKind(new URLSearchParams(search).get("kind")))
      writeKind(next, true);
    let id = "";
    try {
      id = decodeURIComponent(hash.replace(/^#/, ""));
    } catch {
      return;
    }
    if (!kindOfRow(id)) return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView?.({
        behavior: reducedRef.current ? "auto" : "smooth",
        block: "center",
      });
    });
  }, [kindOfRow]);

  useEffect(() => {
    const frame = requestAnimationFrame(fromLocation);
    window.addEventListener("hashchange", fromLocation);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", fromLocation);
    };
  }, [fromLocation]);

  function choose(next: ArchiveKind) {
    setKind(next);
    writeKind(next, false);
  }

  function openCaseStudy(row: ArchiveRow, event: ReactMouseEvent<HTMLElement>) {
    returnFocusRef.current = event.currentTarget;
    setShown(row);
    setSheetOpen(true);
  }

  const headers = [
    "year",
    "project",
    "where",
    "role",
    "tech",
    "links",
  ] as const;

  return (
    <div className="mt-10">
      <div
        role="group"
        aria-label={t("filterLabel")}
        className="flex flex-wrap gap-2"
      >
        {ARCHIVE_KINDS.map((k) => {
          const pressed = active === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={pressed}
              onClick={() => choose(k)}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none sm:min-h-9",
                pressed
                  ? "border-(--role-accent) bg-(--role-accent)/15 text-foreground"
                  : "border-border bg-card/40 text-muted-foreground hover:border-(--role-accent)/60 hover:text-foreground",
              )}
            >
              {t(`kinds.${k}`)}{" "}
              <span
                className={cn(
                  "text-xs tabular-nums",
                  pressed
                    ? "text-(--role-accent-text)"
                    : "text-muted-foreground",
                )}
              >
                {counts[k]}
              </span>
            </button>
          );
        })}
      </div>
      <p role="status" className="sr-only">
        {t("showing", { count: counts[active], total: rows.length })}
      </p>

      <div ref={wrapRef} data-archive-rows="" className="mt-6">
        <table className="w-full border-collapse text-left text-sm max-sm:block">
          <caption className="sr-only">{t("caption")}</caption>
          <thead className="max-sm:sr-only">
            <tr className="border-b border-border">
              {headers.map((key) => (
                <th
                  key={key}
                  scope="col"
                  className="px-3 py-2 text-xs font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase first:pl-0 last:pr-0"
                >
                  {t(`columns.${key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {rows.map((row) => {
              const cs = row.caseStudy;
              const matched = row.roles.includes(role);
              const extra = Math.max(0, row.tech.length - MAX_TECH);
              const links = [
                ...(row.demoUrl
                  ? [{ url: row.demoUrl, label: tp("demo") }]
                  : []),
                ...repoLinks(row.repoUrls, tp),
                ...row.links,
              ];
              return (
                <tr
                  key={row.id}
                  id={`row-${row.id}`}
                  data-archive-kind={row.whereKind}
                  data-highlight={matched ? "true" : undefined}
                  className={cn(
                    "group/row relative scroll-mt-24 border-b border-border/70 align-baseline transition-colors motion-reduce:transition-none",
                    "max-sm:flex max-sm:flex-wrap max-sm:items-baseline max-sm:gap-x-2 max-sm:gap-y-1 max-sm:py-4",
                    "target:bg-(--role-accent)/10",
                    matched && "bg-(--role-accent)/[0.06]",
                    cs &&
                      "hover:bg-card/70 has-[button:focus-visible]:bg-card/70",
                  )}
                >
                  <td
                    className={cn(
                      "py-3 pr-3 text-muted-foreground tabular-nums max-sm:basis-full max-sm:py-0 max-sm:pl-3 max-sm:text-xs sm:pl-3",
                      matched && "shadow-[inset_3px_0_0_var(--role-accent)]",
                    )}
                  >
                    {row.year}
                  </td>
                  <th
                    scope="row"
                    className="px-3 py-3 text-left align-baseline font-normal max-sm:basis-full max-sm:py-0"
                  >
                    {cs ? (
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={(e) => openCaseStudy(row, e)}
                        className="inline-flex cursor-pointer items-baseline gap-1 rounded-sm text-left font-heading text-base font-semibold text-foreground outline-none group-hover/row:text-brand-text after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {row.title}
                        <span className="sr-only">, {tp("viewCaseStudy")}</span>
                        <ChevronRightIcon className="size-3.5 shrink-0 self-center text-muted-foreground" />
                      </button>
                    ) : (
                      <span className="font-heading text-base font-semibold">
                        {row.title}
                      </span>
                    )}
                    {row.featured ? <Star label={t("featured")} /> : null}
                  </th>
                  <td className="px-3 py-3 max-sm:py-0 max-sm:pl-3 max-sm:font-medium">
                    {row.where}
                  </td>
                  <td className="px-3 py-3 text-brand-text max-sm:py-0 max-sm:before:mr-2 max-sm:before:text-muted-foreground max-sm:before:content-['·']">
                    {row.role}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground max-sm:basis-full max-sm:py-0 max-sm:pl-3 max-sm:text-xs">
                    {row.tech.slice(0, MAX_TECH).join(" · ")}
                    {extra > 0 ? (
                      <span className="whitespace-nowrap">
                        {" · "}
                        {tp("moreTech", { count: extra })}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-0 pl-3 max-sm:basis-full max-sm:py-0">
                    {links.length > 0 ? (
                      <ul className="flex flex-wrap gap-x-3 gap-y-1">
                        {links.map((link, i) => (
                          <li key={`${i}:${link.url}`}>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="relative z-10 inline-flex min-h-6 items-center rounded-sm whitespace-nowrap text-brand-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                              {link.label}
                              <span className="sr-only"> {tp("newTab")}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {ARCHIVE_KINDS.filter((k) => k !== "all" && counts[k] === 0).map(
              (k) => (
                <tr key={`empty-${k}`} data-archive-empty={k}>
                  <td
                    colSpan={headers.length}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {t("empty")}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {shown?.caseStudy ? (
        <CaseStudySheet
          open={sheetOpen}
          onOpenChange={(next) => {
            if (!next) setSheetOpen(false);
          }}
          title={shown.title}
          description={[shown.where, shown.role, shown.period]
            .filter(Boolean)
            .join(" · ")}
          caseStudy={shown.caseStudy}
          teamSize={shown.teamSize}
          tech={shown.tech}
          returnFocusRef={returnFocusRef}
        />
      ) : null}
    </div>
  );
}
