"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { flushSync } from "react-dom";
import {
  useMediaQuery,
  usePrefersReducedMotion,
} from "@/components/fx/use-media-query";
import type { CaseStudyItem } from "@/components/sections/case-study/CaseStudyPanel";
import { LazyCaseStudyPanel } from "@/components/sections/case-study/LazyCaseStudyPanel";
import { useCaseParam } from "@/components/sections/case-study/use-case-param";
import { ChevronRightIcon } from "@/components/site/icons";
import { useRole } from "@/components/site/RoleProvider";
import { SECTION_IDS } from "@/components/site/sections";
import type { ArchiveGroup } from "@/lib/archive";
import {
  ARCHIVE_KINDS,
  FILTER_ATTR,
  initialKind,
  parseKind,
  type ArchiveKind,
} from "@/lib/archive-filter";
import { caseItemFromRow } from "@/lib/case-items";
import { repoLinks } from "@/lib/repo-links";
import { cn } from "@/lib/utils";
import { ArchivePreview } from "./ArchivePreview";
import "../experience/journey.css";
import "./archive.css";

const MAX_TECH = 3;
const FLIP_MS = 300;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
/** Shared by the row title and the panel title while (and only while) the opening View Transition runs. */
const TITLE_TRANSITION = "case-title";

type TransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => {
    ready: Promise<void>;
    finished: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
};

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

/** Where each displayed row and year label is on screen now (running transforms included). */
function boxes(root: HTMLElement) {
  const found = new Map<HTMLElement, DOMRect>();
  for (const el of root.querySelectorAll<HTMLElement>(
    "[data-archive-kind], [data-year-head]",
  ))
    if (el.getClientRects().length > 0)
      found.set(el, el.getBoundingClientRect());
  return found;
}

/**
 * FLIP with WAAPI: measure, `apply` (the filter attribute), measure again, then play each element from where it was
 * to where it is. Rows that were hidden fade in; rows that leave are gone at once (display: none).
 */
function flip(root: HTMLElement, apply: () => void) {
  if (typeof root.animate !== "function") {
    apply();
    return;
  }
  const before = boxes(root);
  for (const el of before.keys())
    for (const animation of el.getAnimations?.() ?? []) animation.cancel();
  apply();
  for (const [el, box] of boxes(root)) {
    const was = before.get(el);
    if (!was) {
      el.animate(
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: FLIP_MS, easing: EASE },
      );
      continue;
    }
    const dx = was.left - box.left;
    const dy = was.top - box.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
      { duration: FLIP_MS, easing: EASE },
    );
  }
}

/** The panel's title once the (lazily loaded) panel has rendered it; null after `ms`. */
function panelTitle(ms: number): Promise<HTMLElement | null> {
  const find = () =>
    document.querySelector<HTMLElement>("[data-case-panel] [data-case-title]");
  return new Promise((resolve) => {
    const now = find();
    if (now) return resolve(now);
    const observer = new MutationObserver(() => {
      const el = find();
      if (el) done(el);
    });
    const timer = window.setTimeout(() => done(null), ms);
    function done(el: HTMLElement | null) {
      observer.disconnect();
      window.clearTimeout(timer);
      resolve(el);
    }
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

/**
 * The `/[locale]/projects` archive (spec 5.3): filter chips (All / Work / University / Personal, with counts and a
 * sliding pill) over the projects in year groups, newest year first. Each year is a `<section>` named by its sticky
 * year (serif digits, the kanji year as decoration); each row shows the title (a vermilion ★ seal when featured) and
 * role, where it was done (kind badge, company or school, and the stint for work), three techs then +N, and links.
 *
 * - The chips are toggle buttons; the choice goes to `?kind=` with `history.replaceState` (no reload) and survives a
 *   reload. Rows and emptied years are hidden by CSS from `data-archive-filter` on the wrapper, which the server
 *   page's inline script sets from the URL before the first paint and this component owns afterwards (never
 *   rendered by React, so hydration cannot contradict it). With motion allowed, the remaining rows glide (FLIP) and
 *   the shown ones fade in.
 * - A `#row-<id>` deep link that the filter would hide resets the filter to "all", then the row scrolls into view.
 * - A section link of the site navigation (`#experience`, ...) loads the home page at that section.
 * - The role switcher only highlights rows whose roles include it (`data-highlight`); the order never changes.
 * - A project with a case study opens it in the shared case study panel from a button over its row (click or
 *   Enter), its title morphing into the panel title where View Transitions exist; previous / next walk the rows the
 *   current filter shows. `?case=<id>` opens it on load.
 * - With a mouse and motion allowed, a small preview card (poster, else the title) follows the pointer over a row.
 */
export function ProjectArchive({ groups }: { groups: ArchiveGroup[] }) {
  const t = useTranslations("archive");
  const tp = useTranslations("projects");
  const locale = useLocale();
  const { role } = useRole();
  const reduced = usePrefersReducedMotion();
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  // null until the URL has been read after hydration; the server HTML (and the inline script) cover that moment.
  const [kind, setKind] = useState<ArchiveKind | null>(null);
  const active: ArchiveKind = kind ?? "all";
  const [caseId, setCaseId] = useState<string | null>(null);
  const [wrap, setWrap] = useState<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const pillFrom = useRef<DOMRect | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  const rows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  /** Every row with a case study, with its kind (the filter decides which ones previous / next walk). */
  const caseRows = useMemo(
    () =>
      rows.flatMap((row): { kind: ArchiveKind; item: CaseStudyItem }[] => {
        const item = caseItemFromRow(row, t(`kinds.${row.whereKind}`));
        return item ? [{ kind: row.whereKind, item }] : [];
      }),
    [rows, t],
  );
  const allItems = useMemo(() => caseRows.map((r) => r.item), [caseRows]);
  const openCase = useCaseParam(allItems, setCaseId, "archive");
  const shownItems = caseRows
    .filter((r) => active === "all" || r.kind === active)
    .map((r) => r.item);
  // A deep-linked project that the filter hides still opens, walking the whole list.
  const panelItems =
    caseId !== null && !shownItems.some((i) => i.id === caseId)
      ? allItems
      : shownItems;

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

  const previews = useMemo(
    () =>
      Object.fromEntries(
        rows.map((r) => [r.id, { title: r.title, posterUrl: r.posterUrl }]),
      ),
    [rows],
  );

  const kindOfRow = useMemo(() => {
    const byAnchor = new Map(rows.map((r) => [`row-${r.id}`, r.whereKind]));
    return (id: string) => byAnchor.get(id) ?? null;
  }, [rows]);

  const setWrapNode = useCallback((node: HTMLDivElement | null) => {
    wrapRef.current = node;
    setWrap(node);
  }, []);

  // Never write the attribute before the URL is read: that would undo the inline script's filter for a frame.
  useEffect(() => {
    if (kind) wrapRef.current?.setAttribute(FILTER_ATTR, kind);
  }, [kind]);

  // The active pill slides from the chip it left (measured in `choose`) to the pressed one.
  useLayoutEffect(() => {
    const from = pillFrom.current;
    pillFrom.current = null;
    const pill = chipsRef.current?.querySelector<HTMLElement>("[data-pill]");
    if (!from || !pill || typeof pill.animate !== "function") return;
    const to = pill.getBoundingClientRect();
    if (!to.width) return;
    pill.animate(
      [
        {
          transform: `translateX(${from.left - to.left}px)`,
          width: `${from.width}px`,
        },
        { transform: "none", width: `${to.width}px` },
      ],
      { duration: FLIP_MS, easing: EASE },
    );
  }, [active]);

  const fromLocation = useCallback(() => {
    const { search, hash } = window.location;
    let id = "";
    try {
      id = decodeURIComponent(hash.replace(/^#/, ""));
    } catch {
      // A malformed escape is not a row or a section; the filter still follows ?kind=.
    }
    // The site navigation's section links are in-page `#id` links (so the home bundle carries no routing code).
    // Here the sections do not exist: load the home page at that section, keeping ?role=, and replace this history
    // entry so Back does not bounce through it again.
    if ((SECTION_IDS as readonly string[]).includes(id)) {
      const params = new URLSearchParams(search);
      params.delete("kind");
      const query = params.toString();
      window.location.replace(`/${locale}${query ? `?${query}` : ""}#${id}`);
      return;
    }
    const next = initialKind(search, hash, kindOfRow);
    // Applied now, not in the effect: a row the old filter hid must be displayed before it is scrolled to.
    wrapRef.current?.setAttribute(FILTER_ATTR, next);
    setKind(next);
    // A deep link overrode ?kind=: drop it so a reload shows the same thing.
    if (next !== parseKind(new URLSearchParams(search).get("kind")))
      writeKind(next, true);
    if (!kindOfRow(id)) return;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView?.({
        behavior: reducedRef.current ? "auto" : "smooth",
        block: "center",
      });
    });
  }, [kindOfRow, locale]);

  useEffect(() => {
    const frame = requestAnimationFrame(fromLocation);
    window.addEventListener("hashchange", fromLocation);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", fromLocation);
    };
  }, [fromLocation]);

  function choose(next: ArchiveKind) {
    const root = wrapRef.current;
    const apply = () => root?.setAttribute(FILTER_ATTR, next);
    if (next !== active && !reducedRef.current) {
      pillFrom.current =
        chipsRef.current
          ?.querySelector<HTMLElement>("[data-pill]")
          ?.getBoundingClientRect() ?? null;
      if (root) flip(root, apply);
    } else apply();
    setKind(next);
    writeKind(next, false);
  }

  function openCaseStudy(id: string, event: ReactMouseEvent<HTMLElement>) {
    const button = event.currentTarget;
    returnFocusRef.current = button;
    const start = (document as TransitionDocument).startViewTransition;
    const title = button.querySelector<HTMLElement>("[data-row-title]");
    if (typeof start !== "function" || reducedRef.current || !title) {
      openCase(id);
      return;
    }
    // The row title and the panel title share one name, each only on its side of the transition (two elements
    // with the same name at once would cancel it).
    let target: HTMLElement | null = null;
    title.style.viewTransitionName = TITLE_TRANSITION;
    const transition = start.call(document, async () => {
      title.style.viewTransitionName = "";
      flushSync(() => openCase(id));
      target = await panelTitle(400);
      if (target) target.style.viewTransitionName = TITLE_TRANSITION;
    });
    const clear = () => {
      title.style.viewTransitionName = "";
      if (target) target.style.viewTransitionName = "";
    };
    transition.ready.catch(() => {});
    transition.updateCallbackDone.catch(() => {});
    transition.finished.then(clear, clear);
  }

  return (
    <div className="jt pa">
      <div
        ref={chipsRef}
        role="group"
        aria-label={t("filterLabel")}
        className="pa-filters"
      >
        {ARCHIVE_KINDS.map((k) => {
          const pressed = active === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={pressed}
              onClick={() => choose(k)}
              className="pa-chip"
            >
              {pressed ? (
                <span aria-hidden="true" data-pill="" className="pa-pill" />
              ) : null}
              {t(`kinds.${k}`)} <span className="pa-count">{counts[k]}</span>
            </button>
          );
        })}
      </div>
      <p role="status" className="sr-only">
        {t("showing", { count: counts[active], total: rows.length })}
      </p>

      <div ref={setWrapNode} data-archive-rows="" className="pa-groups">
        {groups.map((group) => (
          <section
            key={group.year}
            data-archive-year={group.year}
            aria-labelledby={`year-${group.year}`}
            className="pa-year"
          >
            <div data-year-head="" className="pa-year-head">
              <h2 id={`year-${group.year}`} className="pa-y">
                {group.year}
              </h2>
              <span aria-hidden="true" lang="ja" className="pa-kanji">
                {group.kanji}
              </span>
            </div>
            <ul className="pa-rows">
              {group.rows.map((row) => {
                const cs = row.caseStudy;
                const matched = row.roles.includes(role);
                const extra = row.tech.slice(MAX_TECH);
                const links = [
                  ...(row.demoUrl
                    ? [{ url: row.demoUrl, label: tp("demo") }]
                    : []),
                  ...repoLinks(row.repoUrls, tp),
                  ...row.links,
                ];
                return (
                  <li
                    key={row.id}
                    id={`row-${row.id}`}
                    data-archive-kind={row.whereKind}
                    data-highlight={matched ? "true" : undefined}
                    className={cn("pa-row", cs && "pa-row-case")}
                  >
                    <div className="pa-main">
                      <span className="pa-title">
                        {row.featured ? (
                          <>
                            <span
                              aria-hidden="true"
                              data-seal=""
                              className="pa-seal"
                            >
                              ★
                            </span>
                            <span className="sr-only">{t("featured")}: </span>
                          </>
                        ) : null}
                        {cs ? (
                          <button
                            type="button"
                            aria-haspopup="dialog"
                            onClick={(e) => openCaseStudy(row.id, e)}
                            className="pa-open"
                          >
                            <span data-row-title="">{row.title}</span>
                            <span className="sr-only">
                              , {tp("viewCaseStudy")}
                            </span>
                          </button>
                        ) : (
                          <span>{row.title}</span>
                        )}
                      </span>
                      <span className="pa-role">{row.role}</span>
                    </div>
                    <p data-where="" className="pa-where">
                      <span className="pa-badge" data-kind={row.whereKind}>
                        {t(`kinds.${row.whereKind}`)}
                      </span>
                      {row.whereKind !== "personal" && row.where ? (
                        <>
                          {" "}
                          <span>{row.where}</span>
                        </>
                      ) : null}
                      {row.stintLabel ? (
                        <>
                          {" "}
                          <span className="pa-stint">
                            <span className="sr-only">{t("stint")} </span>
                            {row.stintLabel}
                          </span>
                        </>
                      ) : null}
                    </p>
                    <p data-tech="" className="pa-tech">
                      {row.tech.slice(0, MAX_TECH).join(" · ")}
                      {extra.length > 0 ? (
                        <>
                          <span className="sr-only">, {extra.join(", ")}</span>
                          <span aria-hidden="true" className="pa-more">
                            {" "}
                            {tp("moreTech", { count: extra.length })}
                          </span>
                        </>
                      ) : null}
                    </p>
                    <div className="pa-go">
                      {links.length > 0 ? (
                        <ul className="pa-links">
                          {links.map((link, i) => (
                            <li key={`${i}:${link.url}`}>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                className="pa-link"
                              >
                                {link.label}
                                <span className="sr-only"> {tp("newTab")}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {cs ? (
                        <span aria-hidden="true" className="pa-cs">
                          {tp("viewCaseStudy")}
                          <ChevronRightIcon className="pa-arrow size-3.5" />
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {ARCHIVE_KINDS.filter((k) => k !== "all" && counts[k] === 0).map(
          (k) => (
            <p key={`empty-${k}`} data-archive-empty={k} className="pa-empty">
              {t("empty")}
            </p>
          ),
        )}
      </div>

      {finePointer && !reduced && wrap ? (
        <ArchivePreview root={wrap} items={previews} />
      ) : null}

      <LazyCaseStudyPanel
        items={panelItems}
        openId={caseId}
        context="archive"
        onOpenChange={openCase}
        returnFocusRef={returnFocusRef}
      />
    </div>
  );
}
