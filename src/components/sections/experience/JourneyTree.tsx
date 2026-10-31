"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { LazyCaseStudyPanel } from "@/components/sections/case-study/LazyCaseStudyPanel";
import { useCaseParam } from "@/components/sections/case-study/use-case-param";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";
import { useScrollEnhancement } from "@/components/fx/use-scroll-enhancement";
import { useHighlight } from "@/components/site/HighlightProvider";
import { ChevronDownIcon } from "@/components/site/icons";
import { getLenis } from "@/components/site/lenis-instance";
import { useRole } from "@/components/site/RoleProvider";
import { caseItemsFromJourney } from "@/lib/case-items";
import type { JourneyChild, JourneyParent } from "@/lib/journey";
import { InkRail } from "./InkRail";

/**
 * The mini Gantt loads after first paint (initial JS budget); its slot reserves the exact height, so nothing shifts.
 * A failed chunk leaves the slot empty instead of taking the page down (the App Router has no catch around it).
 */
const JourneyTimeline = dynamic(
  () =>
    import("./JourneyTimeline").then(
      (module) => module.JourneyTimeline,
      (error) => {
        console.warn("[experience] timeline chunk failed", error);
        return () => null;
      },
    ),
  { ssr: false },
);

/** Rows show this many tech chips, then "+N". */
const ROW_CHIPS = 5;
/** The stagger index of a row is capped, so a long list is never slow to finish. */
const MAX_STAGGER = 6;

function TechChips({
  tech,
  max,
  label,
  more,
}: {
  tech: string[];
  max: number;
  label: string;
  more: (count: number) => string;
}) {
  if (tech.length === 0) return null;
  const extra = tech.length - max;
  return (
    <ul aria-label={label} className="jt-chips">
      {tech.slice(0, max).map((name) => (
        <li key={name} className="jt-chip">
          {name}
        </li>
      ))}
      {extra > 0 ? (
        <li className="jt-chip" data-more="">
          {more(extra)}
        </li>
      ) : null}
    </ul>
  );
}

/**
 * The Experience section as an emaki (spec 5.1, 5.2): an ink rail that fills with scroll, a kanji-year hanko per
 * parent (company or school), and the parent's projects in compact rows. A company with projects shows its mini
 * Gantt and one section per position (stint), newest first, with the promotion between them; a school keeps a flat
 * list. The newest parent starts open; the others are collapsed behind a disclosure button with summary chips.
 *
 * - Collapsed panels and row descriptions stay in the DOM (`inert`, zero height), so no published text leaves the
 *   page source.
 * - A `#exp-<group>` or `#tree-<project>` hash (on load, on hashchange, or any same-page link click, including one
 *   SmoothScroll turns into a pushState) opens the parent that holds it and scrolls the target into view.
 * - Hovering or focusing a row and its Gantt bar lights both (`data-lit`), from one delegated listener; clicking a
 *   bar scrolls to its row. No React state changes on hover.
 * - The role switcher only highlights the children whose roles include it; the order never changes.
 * - The ink rail's fill is driven by the shared scroll engine (lazy, near the viewport); `data-progress` mirrors it.
 * - Motion is CSS under `<html data-motion="full">` (journey.css); otherwise everything is instant and static.
 */
export function JourneyTree({ parents }: { parents: JourneyParent[] }) {
  const t = useTranslations("experience");
  const ta = useTranslations("archive");
  const { role } = useRole();
  const reduced = usePrefersReducedMotion();
  const { ids: lit } = useHighlight();
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(parents.slice(0, 1).map((p) => p.key)),
  );
  const [described, setDescribed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [target, setTarget] = useState<{ id: string; seq: number } | null>(
    null,
  );
  const [caseId, setCaseId] = useState<string | null>(null);
  const caseItems = useMemo(
    () =>
      caseItemsFromJourney(parents, (kind) =>
        ta(kind === "company" ? "kinds.work" : "kinds.university"),
      ),
    [parents, ta],
  );
  const openCase = useCaseParam(caseItems, setCaseId, "tree");
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // The ink rail's fill follows scroll progress through the tree (static and full under reduced motion).
  useScrollEnhancement(rootRef, "beam", reduced);
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  /** Parent key of every anchor in the tree: the parent's own and each child's. */
  const ownerOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of parents) {
      map.set(p.anchor, p.key);
      for (const c of p.children) map.set(c.anchor, p.key);
    }
    return map;
  }, [parents]);

  /** Opens the parent that holds `#id`; with `scroll`, also brings the target into view once it is open. */
  const reveal = useCallback(
    (hash: string, scroll = true) => {
      let id: string;
      try {
        id = decodeURIComponent(hash.replace(/^#/, ""));
      } catch {
        return;
      }
      const key = ownerOf.get(id);
      if (!key) return;
      setOpen((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
      if (scroll) setTarget((prev) => ({ id, seq: (prev?.seq ?? 0) + 1 }));
    },
    [ownerOf],
  );

  useEffect(() => {
    const fromLocation = () => reveal(window.location.hash);
    // Every plain click on a same-page link into the tree opens the parent, whatever happens to the URL next:
    // SmoothScroll (Lenis) cancels the click and uses pushState, and a link to the hash already in the URL fires no
    // hashchange either. Capture phase, so this runs before any handler that cancels the click. While Lenis runs it
    // also does the scrolling (the target's position does not depend on its panel being open); otherwise this
    // component scrolls, as for a hashchange.
    const onClick = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (
        !(link instanceof HTMLAnchorElement) ||
        (link.target && link.target !== "_self")
      )
        return;
      const url = new URL(link.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        url.pathname !== window.location.pathname ||
        url.hash.length < 2
      )
        return;
      reveal(url.hash, !getLenis());
    };
    const frame = requestAnimationFrame(fromLocation);
    window.addEventListener("hashchange", fromLocation);
    document.addEventListener("click", onClick, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", fromLocation);
      document.removeEventListener("click", onClick, true);
    };
  }, [reveal]);

  // Scroll once the parent is open. The target's position does not depend on the panel's height, so this need not
  // wait for the transition.
  useEffect(() => {
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(target.id)?.scrollIntoView?.({
        behavior: reducedRef.current ? "auto" : "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);

  // Row <-> Gantt bar sync and hanko stamps: plain DOM listeners on the tree, no React state per hover.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let hover: string | undefined;
    let focus: string | undefined;
    const types = ["mouseover", "mouseleave", "focusin", "focusout", "click"];
    const onEvent = (event: Event) => {
      const node = (event.target as Element).closest?.<HTMLElement>(
        "[data-sync]",
      );
      const id = node?.dataset.sync;
      if (event.type === "click") {
        // A Gantt bar scrolls to its row.
        const row = node?.hasAttribute("data-bar")
          ? document.getElementById(`tree-${id}`)
          : null;
        const lenis = getLenis();
        if (row && lenis)
          lenis.scrollTo(row, { offset: -window.innerHeight / 3 });
        else
          row?.scrollIntoView({
            behavior: reducedRef.current ? "auto" : "smooth",
            block: "center",
          });
        return;
      }
      if (event.type === "mouseover") hover = id;
      else if (event.type === "mouseleave") hover = undefined;
      else if (event.type === "focusin") focus = id;
      else if (!root.contains((event as FocusEvent).relatedTarget as Node))
        focus = undefined;
      root.querySelectorAll<HTMLElement>("[data-sync]").forEach((n) => {
        n.toggleAttribute(
          "data-lit",
          n.dataset.sync === hover || n.dataset.sync === focus,
        );
      });
    };
    for (const type of types) root.addEventListener(type, onEvent);

    // Each hanko stamps once, the first time it scrolls into view (the CSS animation only runs with motion on).
    const stamps =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            for (const entry of entries)
              if (entry.isIntersecting) {
                (entry.target as HTMLElement).dataset.stamped = "";
                stamps?.unobserve(entry.target);
              }
          });
    root
      .querySelectorAll("[data-hanko]")
      .forEach((node) => stamps?.observe(node));

    return () => {
      for (const type of types) root.removeEventListener(type, onEvent);
      stamps?.disconnect();
    };
  }, []);

  function toggle(key: string, panelId: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
    // Only a panel the visitor toggled plays the row stagger (not the one open on load).
    document.getElementById(panelId)?.setAttribute("data-anim", "");
  }

  function toggleDescription(id: string) {
    setDescribed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function openCaseStudy(id: string, event: ReactMouseEvent<HTMLElement>) {
    returnFocusRef.current = event.currentTarget;
    openCase(id);
  }

  function renderChild(child: JourneyChild, index: number, level: 4 | 5) {
    const cs = child.caseStudy;
    const highlighted = lit.includes(child.anchor);
    const matched = child.roles.includes(role);
    const Heading = level === 4 ? "h4" : "h5";
    const descId = `desc-${child.id}`;
    const showDesc = described.has(child.id);
    return (
      <li
        key={child.id}
        id={child.anchor}
        data-journey-child=""
        data-sync={child.id}
        data-highlight={highlighted ? "true" : undefined}
        data-role-match={matched ? "true" : undefined}
        className="jt-row"
        style={{ "--i": Math.min(index, MAX_STAGGER) } as CSSProperties}
      >
        <div className="jt-card">
          <div className="jt-top">
            <Heading className="jt-title">{child.title}</Heading>
            <p className="jt-when">
              {child.period} · {child.duration}
            </p>
          </div>
          {child.role || child.teamSize ? (
            <div className="jt-top">
              {child.role ? <p className="jt-role">{child.role}</p> : null}
              {child.teamSize ? (
                <p className="jt-team">
                  {t("teamSize", { size: child.teamSize })}
                </p>
              ) : null}
            </div>
          ) : null}
          {child.result ? (
            <p className="jt-result">
              <span aria-hidden="true" lang="ja" className="jt-result-mark">
                果
              </span>
              <span>{child.result}</span>
            </p>
          ) : null}
          <TechChips
            tech={child.tech}
            max={ROW_CHIPS}
            label={t("techLabel")}
            more={(count) => t("moreTech", { count })}
          />
          {child.summary ? (
            <div
              id={descId}
              className="jt-desc"
              data-state={showDesc ? "open" : "closed"}
              inert={!showDesc}
            >
              <div>
                <p className="jt-sum">{child.summary}</p>
              </div>
            </div>
          ) : null}
          <div className="jt-foot">
            {child.summary ? (
              <button
                type="button"
                aria-expanded={showDesc}
                aria-controls={descId}
                onClick={() => toggleDescription(child.id)}
                className="jt-more"
              >
                {showDesc ? t("hideDescription") : t("showDescription")}
              </button>
            ) : null}
            {child.links.map((link, i) => (
              <a
                key={`${i}:${link.url}`}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="jt-a"
              >
                {link.label}
              </a>
            ))}
            {cs ? (
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={(e) => openCaseStudy(child.id, e)}
                className="jt-cs"
              >
                {t("viewCaseStudy")}
                <span className="sr-only">: {child.title}</span>
                <span aria-hidden="true" className="jt-arrow">
                  →
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </li>
    );
  }

  function renderBody(parent: JourneyParent) {
    if (parent.kind === "school" || parent.children.length === 0)
      return parent.children.length > 0 ? (
        <ol className="jt-stint jt-rows">
          {parent.children.map((child, i) => renderChild(child, i, 4))}
        </ol>
      ) : null;
    let index = 0;
    return (
      <>
        {parent.timeline ? (
          <div
            className="jt-slot"
            style={
              { "--rows": parent.timeline.bars.length + 1 } as CSSProperties
            }
          >
            <JourneyTimeline parent={parent} />
          </div>
        ) : null}
        {parent.stints.map((stint, i) => {
          const rows =
            stint.children.length > 0 ? (
              <ol className="jt-rows">
                {stint.children.map((child) => renderChild(child, index++, 5))}
              </ol>
            ) : null;
          const next = parent.stints[i + 1];
          const headingId = `${parent.anchor}-stint-${i}`;
          return (
            <div key={stint.id || "rest"}>
              {stint.id ? (
                <section aria-labelledby={headingId} className="jt-stint">
                  <h4 id={headingId} className="jt-stint-h">
                    <span>{stint.title}</span>
                    <span className="jt-when">{stint.period}</span>
                    <span className="jt-dur">{stint.duration}</span>
                  </h4>
                  {rows}
                </section>
              ) : (
                <div className="jt-stint">{rows}</div>
              )}
              {next && stint.promotedFrom ? (
                <p className="jt-promo">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 8 10"
                    width="0.7em"
                    height="0.875em"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 9.25V1M1 4l3-3 3 3" />
                  </svg>
                  <span>{t("promoted", { month: stint.promotedFrom })}</span>
                </p>
              ) : next ? (
                <div aria-hidden="true" className="jt-link" />
              ) : null}
            </div>
          );
        })}
      </>
    );
  }

  return (
    <div
      ref={rootRef}
      className="jt"
      data-journey-tree=""
      data-ink-rail=""
      data-progress={reduced ? "1" : "0"}
    >
      <InkRail />
      <ol className="jt-list">
        {parents.map((parent) => {
          const isOpen = open.has(parent.key);
          const panelId = `${parent.anchor}-panel`;
          const parentLit = lit.includes(parent.anchor);
          const stintCount = parent.stints.filter((s) => s.id !== "").length;
          const showStints =
            parent.kind === "company" && parent.children.length > 0;
          const lines = showStints
            ? []
            : parent.lines.filter(
                (line) => line.title || line.period !== parent.period,
              );
          const meta =
            parent.kind === "school" ? t("education") : parent.location;
          return (
            <li
              key={parent.key}
              id={parent.anchor}
              data-journey-parent=""
              data-highlight={parentLit ? "true" : undefined}
              className="jt-parent"
            >
              <span
                data-hanko=""
                data-state={isOpen ? "open" : "closed"}
                aria-hidden="true"
                lang="ja"
                className="jt-hanko"
              >
                {parent.hankoYear}
              </span>
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  title={isOpen ? t("collapse") : t("expand")}
                  onClick={() => toggle(parent.key, panelId)}
                  className="jt-head"
                >
                  <span className="jt-name">{parent.name}</span>
                  <span className="jt-meta">
                    <span className="jt-period">{parent.period}</span>
                    {` · ${parent.duration}`}
                    {meta ? ` · ${meta}` : null}
                  </span>
                  <ChevronDownIcon aria-hidden className="jt-chev size-4" />
                  <span className="jt-pills">
                    {parent.chip ? (
                      <span className="jt-pill" data-tone="koi">
                        {"count" in parent.chip
                          ? t("projectsCount", { count: parent.chip.count })
                          : t("internshipChip")}
                      </span>
                    ) : null}
                    {stintCount > 1 ? (
                      <span className="jt-pill">
                        {t("positionsCount", { count: stintCount })}
                      </span>
                    ) : null}
                    {parent.summaryLabel ? (
                      <span className="jt-pill">{parent.summaryLabel}</span>
                    ) : null}
                    {parent.gpa ? (
                      <span className="jt-pill">
                        {t("gpa", { gpa: parent.gpa })}
                      </span>
                    ) : null}
                  </span>
                </button>
              </h3>
              {lines.length > 0 ? (
                <ul data-journey-lines="" className="jt-lines">
                  {lines.map((line, i) => (
                    <li key={`${i}:${line.title}`}>
                      <span>{line.title}</span>
                      {line.period !== parent.period ? (
                        <span className="jt-when">{line.period}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div
                id={panelId}
                data-journey-panel=""
                data-state={isOpen ? "open" : "closed"}
                inert={!isOpen}
                className="jt-panel"
              >
                <div>
                  {parent.summary ? (
                    <p className="jt-sum">{parent.summary}</p>
                  ) : null}
                  <TechChips
                    tech={parent.tech}
                    max={8}
                    label={t("techLabel")}
                    more={(count) => t("moreTech", { count })}
                  />
                  {renderBody(parent)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <LazyCaseStudyPanel
        items={caseItems}
        openId={caseId}
        context="tree"
        onOpenChange={openCase}
        returnFocusRef={returnFocusRef}
      />
    </div>
  );
}
