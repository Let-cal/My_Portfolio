"use client";

import { ChevronRightIcon } from "lucide-react";
import * as motion from "motion/react-m";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState, type FocusEvent } from "react";
import { GlowCard } from "@/components/fx/GlowCard";
import { TracingBeam } from "@/components/fx/TracingBeam";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";
import { useHighlight } from "@/components/site/HighlightProvider";
import { useRole } from "@/components/site/RoleProvider";
import type { RoleKey } from "@/content/schema";
import { cn } from "@/lib/utils";
import type { CaseStudyView } from "./CaseStudySheet";

const CaseStudySheet = dynamic(() => import("./CaseStudySheet").then((module) => module.CaseStudySheet), { ssr: false });

/** One experience with every string already picked for the current locale. */
export type TimelineItem = {
  id: string;
  company: string;
  parentCompany: string | null;
  position: string;
  period: string;
  summary: string;
  tech: string[];
  teamSize: string | null;
  links: { label: string; url: string }[];
  caseStudy: CaseStudyView | null;
};

/** Header shown above the experiences that share a parent company. */
export type CompanyView = {
  name: string;
  period: string;
  /** Position lines under the header, e.g. intern then engineer. */
  lines: { title: string; period: string }[];
};

export type EducationView = {
  id: string;
  school: string;
  degree: string;
  major: string;
  period: string;
  gpa: string | null;
  notes: string | null;
};

export type TimelineData = {
  items: Record<string, TimelineItem>;
  /** Item ids per role, already in that role's order. */
  orders: Record<RoleKey, string[]>;
  companies: Record<string, CompanyView>;
  education: EducationView[];
};

type Group = { key: string; company: CompanyView | null; items: TimelineItem[] };

/** Groups the ordered items by parent company; a group sits where its first item sits. */
function buildGroups(ids: string[], data: TimelineData): Group[] {
  const groups: Group[] = [];
  const byCompany = new Map<string, Group>();
  for (const id of ids) {
    const item = data.items[id];
    if (!item) continue;
    const company = item.parentCompany ? data.companies[item.parentCompany] : undefined;
    if (!company || !item.parentCompany) {
      groups.push({ key: item.id, company: null, items: [item] });
      continue;
    }
    let group = byCompany.get(item.parentCompany);
    if (!group) {
      group = { key: item.parentCompany, company, items: [] };
      byCompany.set(item.parentCompany, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

const MAX_CHIPS = 8;

/* Columns: [river] [content] on phones; [dates] [river] [content] from md up. */
const ROW = "grid grid-cols-[2rem_minmax(0,1fr)] md:grid-cols-[9.5rem_3rem_minmax(0,1fr)]";
const DATE = "col-start-2 row-start-1 pb-2 text-sm font-medium tabular-nums text-brand-text md:col-start-1 md:pt-5 md:pb-0 md:text-right";
const NODE = "col-start-1 row-start-1 row-span-2 justify-self-center rounded-full md:col-start-2 md:row-span-1";

/**
 * The experience list as a river: a tracing beam runs down behind it and fills as the visitor scrolls, dates sit on the left (above the card on
 * phones), SKG experiences are grouped under one company header, Education closes the list. The order follows the
 * current role and animates when the role changes. Hovering or focusing an item dims the others.
 */
export function Timeline({ data }: { data: TimelineData }) {
  const t = useTranslations("experience");
  const { role } = useRole();
  const reduced = usePrefersReducedMotion();
  const { ids: highlightIds } = useHighlight();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [shownId, setShownId] = useState<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const groups = useMemo(() => buildGroups(data.orders[role], data), [data, role]);
  const shown = shownId ? data.items[shownId] : null;
  const shownCompany = shown?.parentCompany ? data.companies[shown.parentCompany] : undefined;

  function openCaseStudy(id: string, trigger: HTMLElement) {
    returnFocusRef.current = trigger;
    setShownId(id);
    setOpenId(id);
  }

  const hoverProps = (id: string) => ({
    onMouseEnter: () => setHoveredId(id),
    onMouseLeave: () => setHoveredId((current) => (current === id ? null : current)),
    onFocus: () => setHoveredId(id),
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHoveredId((current) => (current === id ? null : current));
    },
  });
  const dimmed = (id: string) => hoveredId !== null && hoveredId !== id;

  function renderItem(item: TimelineItem, grouped: boolean) {
    const Heading = grouped ? "h4" : "h3";
    const active = hoveredId === item.id;
    const lit = highlightIds.includes(`exp-${item.id}`);
    const cs = item.caseStudy;
    const extra = Math.max(0, item.tech.length - MAX_CHIPS);
    return (
      <motion.li
        key={item.id}
        id={`exp-${item.id}`}
        data-highlight={lit ? "true" : undefined}
        layout={reduced ? false : "position"}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className={cn("scroll-mt-24 py-3 transition-opacity duration-200", dimmed(item.id) && "opacity-50")}
        {...hoverProps(item.id)}
      >
        <div className={ROW}>
          <p className={DATE}>{item.period}</p>
          <span
            aria-hidden
            className={cn(
              NODE,
              "mt-1.5 size-3 border-2 border-brand-400 bg-background transition-all duration-200 md:mt-6",
              active && "scale-125 bg-brand-400 shadow-[0_0_14px_2px_var(--brand-500)]",
              lit && "border-(--role-accent) shadow-[0_0_14px_2px_var(--role-accent)]",
            )}
          />
          <GlowCard
            className={cn(
              "relative col-start-2 row-start-2 min-w-0 rounded-xl border border-border bg-card/60 p-4 backdrop-blur-md transition-colors duration-200 sm:p-5 md:col-start-3 md:row-start-1",
              active && "border-brand-400/60 bg-card/80",
              lit && "border-(--role-accent) bg-card/80 shadow-[0_0_30px_-8px_var(--role-accent)]",
              cs && "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
            )}
          >
            <Heading className="font-heading text-lg leading-snug font-semibold">
              {cs ? (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={(e) => openCaseStudy(item.id, e.currentTarget)}
                  className="cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
                >
                  {item.company}
                  <span className="sr-only">, {t("viewCaseStudy")}</span>
                </button>
              ) : (
                item.company
              )}
            </Heading>
            <p className="mt-0.5 text-sm font-medium text-brand-text">{item.position}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
            {item.teamSize ? <p className="mt-3 text-xs text-muted-foreground">{t("teamSize", { size: item.teamSize })}</p> : null}
            {item.tech.length > 0 ? (
              <ul aria-label={t("techLabel")} className="mt-3 flex flex-wrap gap-1.5">
                {item.tech.slice(0, MAX_CHIPS).map((name) => (
                  <li key={name} className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs text-foreground/90">
                    {name}
                  </li>
                ))}
                {extra > 0 ? (
                  <li className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground">{t("moreTech", { count: extra })}</li>
                ) : null}
              </ul>
            ) : null}
            {item.links.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {item.links.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="relative z-10 text-sm text-brand-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {cs ? (
              <span aria-hidden className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-text">
                {t("viewCaseStudy")}
                <ChevronRightIcon className={cn("size-4 transition-transform", active && "translate-x-0.5")} />
              </span>
            ) : null}
          </GlowCard>
        </div>
      </motion.li>
    );
  }

  return (
    <div className="relative">
      <TracingBeam>
        <ol className="relative">
          {groups.map((group) => (
            <li key={group.key} className="pb-4">
              {group.company ? (
                <div className={cn(ROW, "pt-2 pb-1")}>
                  <span
                    aria-hidden
                    className={cn(NODE, "mt-1 size-4 bg-brand-500 ring-4 ring-background md:mt-1.5")}
                  />
                  <div className="col-start-2 row-start-1 min-w-0 md:col-start-3">
                    <h3 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                      {group.company.name} · <span className="font-normal text-muted-foreground">{group.company.period}</span>
                    </h3>
                    {group.company.lines.length > 0 ? (
                      <ul className="mt-2 flex flex-col gap-1">
                        {group.company.lines.map((line) => (
                          <li key={line.title} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                            <span className="font-medium text-foreground/90">{line.title}</span>
                            <span className="tabular-nums text-muted-foreground">{line.period}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <ol>{group.items.map((item) => renderItem(item, group.company !== null))}</ol>
            </li>
          ))}

          {data.education.map((edu) => (
            <li
              key={edu.id}
              id={`edu-${edu.id}`}
              className={cn("scroll-mt-24 py-3 transition-opacity duration-200", dimmed(edu.id) && "opacity-50")}
              {...hoverProps(edu.id)}
            >
              <div className={ROW}>
                <p className={DATE}>{edu.period}</p>
                <span
                  aria-hidden
                  className={cn(
                    NODE,
                    "mt-1.5 size-3 border-2 border-teal-400 bg-background transition-all duration-200 md:mt-6",
                    hoveredId === edu.id && "scale-125 bg-teal-400",
                  )}
                />
                <GlowCard
                  className={cn(
                    "col-start-2 row-start-2 min-w-0 rounded-xl border border-border bg-card/60 p-4 backdrop-blur-md transition-colors duration-200 sm:p-5 md:col-start-3 md:row-start-1",
                    hoveredId === edu.id && "border-teal-400/60 bg-card/80",
                  )}
                >
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("education")}</p>
                  <h3 className="mt-1 font-heading text-lg leading-snug font-semibold">{edu.school}</h3>
                  <p className="mt-0.5 text-sm font-medium text-brand-text">{edu.degree}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{edu.major}</p>
                  {edu.gpa ? <p className="mt-3 text-sm text-muted-foreground">{t("gpa", { gpa: edu.gpa })}</p> : null}
                  {edu.notes ? <p className="mt-1 text-sm text-muted-foreground">{edu.notes}</p> : null}
                </GlowCard>
              </div>
            </li>
          ))}
        </ol>
      </TracingBeam>

      {shown?.caseStudy ? (
        <CaseStudySheet
          open={openId !== null}
          onOpenChange={(next) => {
            if (!next) setOpenId(null);
          }}
          title={`${shown.position} · ${shown.company}`}
          description={[shownCompany?.name, shown.period].filter(Boolean).join(" · ")}
          caseStudy={shown.caseStudy}
          teamSize={shown.teamSize}
          tech={shown.tech}
          returnFocusRef={returnFocusRef}
        />
      ) : null}
    </div>
  );
}
