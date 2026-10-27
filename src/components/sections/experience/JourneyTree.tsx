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
import { GlowCard } from "@/components/fx/GlowCard";
import { TracingBeam } from "@/components/fx/TracingBeam";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";
import { useHighlight } from "@/components/site/HighlightProvider";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/site/icons";
import { useRole } from "@/components/site/RoleProvider";
import type { JourneyChild, JourneyParent } from "@/lib/journey";
import { cn } from "@/lib/utils";

const CaseStudySheet = dynamic(
  () => import("./CaseStudySheet").then((module) => module.CaseStudySheet),
  { ssr: false },
);

const MAX_CHIPS = 8;

function TechChips({
  tech,
  label,
  more,
}: {
  tech: string[];
  label: string;
  more: (count: number) => string;
}) {
  if (tech.length === 0) return null;
  const extra = Math.max(0, tech.length - MAX_CHIPS);
  return (
    <ul aria-label={label} className="mt-3 flex flex-wrap gap-1.5">
      {tech.slice(0, MAX_CHIPS).map((name) => (
        <li
          key={name}
          className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs text-foreground/90"
        >
          {name}
        </li>
      ))}
      {extra > 0 ? (
        <li className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground">
          {more(extra)}
        </li>
      ) : null}
    </ul>
  );
}

/**
 * The Experience section as a vertical journey (mockup A): a rail with the Koi orange-to-teal gradient (and the
 * scroll-filling beam over it), one dot per parent (company or school), and the parent's projects hanging off a
 * dashed branch. The newest parent starts open; the others are collapsed behind a disclosure button with a chip.
 *
 * - Collapsed panels stay in the DOM (`inert`, zero height) so no published text leaves the page source.
 * - A `#exp-<group>` or `#tree-<project>` hash (on load, on hashchange, or a same-hash link click) opens the parent
 *   that holds it and scrolls the target into view.
 * - The role switcher only highlights the children whose roles include it; the order never changes.
 * - Height and opacity transition in CSS; under reduced motion the panel switches instantly.
 */
export function JourneyTree({ parents }: { parents: JourneyParent[] }) {
  const t = useTranslations("experience");
  const { role } = useRole();
  const reduced = usePrefersReducedMotion();
  const { ids: lit } = useHighlight();
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(parents.slice(0, 1).map((p) => p.key)),
  );
  const [target, setTarget] = useState<{ id: string; seq: number } | null>(
    null,
  );
  const [shown, setShown] = useState<{
    parent: string;
    child: JourneyChild;
  } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
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

  const reveal = useCallback(
    (hash: string) => {
      let id: string;
      try {
        id = decodeURIComponent(hash.replace(/^#/, ""));
      } catch {
        return;
      }
      const key = ownerOf.get(id);
      if (!key) return;
      setOpen((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
      setTarget((prev) => ({ id, seq: (prev?.seq ?? 0) + 1 }));
    },
    [ownerOf],
  );

  useEffect(() => {
    const fromLocation = () => reveal(window.location.hash);
    // A link to the hash already in the URL fires no hashchange; catch that click so it still opens the parent.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const link = (event.target as Element | null)?.closest?.("a[href^='#']");
      if (
        link instanceof HTMLAnchorElement &&
        link.hash !== "" &&
        link.hash === window.location.hash
      )
        fromLocation();
    };
    const frame = requestAnimationFrame(fromLocation);
    window.addEventListener("hashchange", fromLocation);
    document.addEventListener("click", onClick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", fromLocation);
      document.removeEventListener("click", onClick);
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

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  function openCaseStudy(
    parent: string,
    child: JourneyChild,
    event: ReactMouseEvent<HTMLElement>,
  ) {
    returnFocusRef.current = event.currentTarget;
    setShown({ parent, child });
    setSheetOpen(true);
  }

  function renderChild(parent: JourneyParent, child: JourneyChild) {
    const cs = child.caseStudy;
    const highlighted = lit.includes(child.anchor);
    const matched = child.roles.includes(role);
    return (
      <li
        key={child.id}
        id={child.anchor}
        data-journey-child=""
        data-highlight={highlighted ? "true" : undefined}
        data-role-match={matched ? "true" : undefined}
        className="relative scroll-mt-24 before:absolute before:top-7 before:-left-5 before:w-4 before:border-t before:border-dashed before:border-border before:content-['']"
      >
        <GlowCard
          className={cn(
            "relative min-w-0 rounded-xl border border-border bg-card/60 p-4 backdrop-blur-md transition-[border-color,box-shadow,background-color] duration-200 sm:p-5",
            matched &&
              "border-(--role-accent)/60 shadow-[0_0_0_1px_var(--role-accent)]",
            highlighted &&
              "border-(--role-accent) bg-card/80 shadow-[0_0_30px_-8px_var(--role-accent)]",
            cs && "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
          )}
        >
          <h4 className="font-heading text-lg leading-snug font-semibold">
            {cs ? (
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={(e) => openCaseStudy(parent.name, child, e)}
                className="cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
              >
                {child.title}
                <span className="sr-only">, {t("viewCaseStudy")}</span>
              </button>
            ) : (
              child.title
            )}
          </h4>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm">
            {child.role ? (
              <span className="font-medium text-brand-text">{child.role}</span>
            ) : null}
            <span className="text-muted-foreground tabular-nums">
              {child.period}
            </span>
          </p>
          {child.summary ? (
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
              {child.summary}
            </p>
          ) : null}
          {child.teamSize ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("teamSize", { size: child.teamSize })}
            </p>
          ) : null}
          <TechChips
            tech={child.tech}
            label={t("techLabel")}
            more={(count) => t("moreTech", { count })}
          />
          {child.links.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {child.links.map((link, i) => (
                <li key={`${i}:${link.url}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="relative z-10 text-sm text-brand-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {cs ? (
            <span
              aria-hidden
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-text"
            >
              {t("viewCaseStudy")}
              <ChevronRightIcon className="size-4" />
            </span>
          ) : null}
        </GlowCard>
      </li>
    );
  }

  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-[calc(0.5rem-1px)] w-0.5 rounded-full bg-linear-to-b from-brand-500 via-brand-500/60 to-teal-400/40"
      />
      <TracingBeam railClassName="left-0 w-4" trackClassName="text-transparent">
        <ol className="relative flex flex-col gap-8 pl-8">
          {parents.map((parent) => {
            const isOpen = open.has(parent.key);
            const panelId = `${parent.anchor}-panel`;
            const childLit = parent.children.some((c) =>
              lit.includes(c.anchor),
            );
            const parentLit = lit.includes(parent.anchor);
            const lines = parent.lines.filter(
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
                className="relative scroll-mt-24"
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-2 -left-8 size-4 rounded-full border-2 border-brand-500 bg-background ring-4 ring-background transition-[background-color,box-shadow,border-color] duration-200",
                    isOpen && "bg-brand-500",
                    (parentLit || childLit) &&
                      "border-(--role-accent) shadow-[0_0_14px_2px_var(--role-accent)]",
                  )}
                />
                <h3 className="font-heading">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    title={isOpen ? t("collapse") : t("expand")}
                    onClick={() => toggle(parent.key)}
                    className="group/parent inline-flex max-w-full cursor-pointer flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background focus-visible:outline-none"
                  >
                    <span className="text-xl font-semibold tracking-tight sm:text-2xl">
                      {parent.name}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground tabular-nums">
                      {parent.period}
                    </span>
                    {parent.chip ? (
                      <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground/85">
                        {"count" in parent.chip
                          ? t("projectsCount", { count: parent.chip.count })
                          : t("internshipChip")}
                      </span>
                    ) : null}
                    <ChevronDownIcon
                      aria-hidden
                      className={cn(
                        "size-4 self-center text-muted-foreground group-hover/parent:text-foreground",
                        !reduced && "transition-transform duration-300",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </h3>
                {meta ? (
                  <p className="mt-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {meta}
                  </p>
                ) : null}
                {lines.length > 0 ? (
                  <ul
                    data-journey-lines=""
                    className="mt-2 flex flex-col gap-1"
                  >
                    {lines.map((line, i) => (
                      <li
                        key={`${i}:${line.title}`}
                        className="flex flex-wrap items-baseline gap-x-3 text-sm"
                      >
                        <span className="font-medium text-foreground/90">
                          {line.title}
                        </span>
                        {line.period !== parent.period ? (
                          <span className="text-muted-foreground tabular-nums">
                            {line.period}
                          </span>
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
                  className={cn(
                    "grid",
                    isOpen
                      ? "visible grid-rows-[1fr] opacity-100"
                      : "invisible grid-rows-[0fr] opacity-0",
                    reduced
                      ? "transition-none"
                      : "transition-[grid-template-rows,opacity,visibility] duration-300 ease-out",
                  )}
                >
                  <div className="min-h-0 overflow-clip [overflow-clip-margin:0.75rem]">
                    {parent.gpa ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {t("gpa", { gpa: parent.gpa })}
                      </p>
                    ) : null}
                    {parent.summary ? (
                      <p className="mt-3 max-w-3xl text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                        {parent.summary}
                      </p>
                    ) : null}
                    <TechChips
                      tech={parent.tech}
                      label={t("techLabel")}
                      more={(count) => t("moreTech", { count })}
                    />
                    {parent.children.length > 0 ? (
                      <ol className="mt-4 ml-1 flex flex-col gap-3 border-l border-dashed border-border pl-5">
                        {parent.children.map((child) =>
                          renderChild(parent, child),
                        )}
                      </ol>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </TracingBeam>

      {shown?.child.caseStudy ? (
        <CaseStudySheet
          open={sheetOpen}
          onOpenChange={(next) => {
            if (!next) setSheetOpen(false);
          }}
          title={shown.child.title}
          description={[shown.parent, shown.child.role, shown.child.period]
            .filter(Boolean)
            .join(" · ")}
          caseStudy={shown.child.caseStudy}
          teamSize={shown.child.teamSize}
          tech={shown.child.tech}
          returnFocusRef={returnFocusRef}
        />
      ) : null}
    </div>
  );
}
