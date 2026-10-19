"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";
import { useHighlight } from "@/components/site/HighlightProvider";
import { useRole } from "@/components/site/RoleProvider";
import type { RoleKey, SkillGroup } from "@/content/schema";
import { clsx } from "clsx";
import { cn } from "@/lib/utils";
const SkillBeams = dynamic(
  () => import("./SkillBeams").then((module) => module.SkillBeams),
  { ssr: false },
);
import { SkillGlyph, SkillMonogram } from "./SkillGlyph";
import { SkillTerminal } from "./SkillTerminal";

/** One experience or project that used a skill, with strings already picked for the locale. */
export type EvidenceView = {
  kind: "exp" | "proj";
  id: string;
  /** Element id of the real card on the page (`exp-<id>` / `proj-<id>`). */
  anchor: string;
  title: string;
  role: string;
  period: string;
};

export type SkillView = {
  id: string;
  name: string;
  group: SkillGroup;
  monogram: string;
  /** Brand colours; null when there is no glyph and the chip shows a monogram tile. */
  icon: { hex: string; hexDark: string } | null;
  evidence: EvidenceView[];
};

export type SkillMapData = {
  name: string;
  /** Title of each role, for `whoami`. */
  titles: Record<RoleKey, string>;
  /** Group order of each role (groups without skills are already left out). */
  orders: Record<RoleKey, SkillGroup[]>;
  skills: SkillView[];
};

const NO_EVIDENCE: EvidenceView[] = [];

const ARROW_STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/**
 * The skill map. Groups follow the current role. Choosing a skill lists the experiences and projects behind it as
 * mini-cards in the evidence panel, draws an animated beam from the chip to each card, and lights up the real
 * `#exp-*` / `#proj-*` cards through the HighlightProvider. The terminal types the current group's skills.
 * Wide screens keep the terminal and evidence panel sticky beside the groups; narrower ones stack them and dock the
 * evidence panel to the bottom of the viewport while a skill is selected.
 */
export function SkillMap({ data }: { data: SkillMapData }) {
  const t = useTranslations("skills");
  const { role } = useRole();
  const reduced = usePrefersReducedMotion();
  const { setIds } = useHighlight();

  const containerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef(new Map<string, HTMLElement>());
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const getChip = useCallback(
    (id: string) => chipRefs.current.get(id) ?? null,
    [],
  );
  const getCard = useCallback(
    (id: string) => cardRefs.current.get(id) ?? null,
    [],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Group picked by hand or through a skill; only valid for the role it was picked under. */
  const [pick, setPick] = useState<{ role: RoleKey; group: SkillGroup } | null>(
    null,
  );
  const [activeCard, setActiveCard] = useState<string | null>(null);
  /** Chip that holds the tab stop of each group (roving tabindex). */
  const [rove, setRove] = useState<Record<string, string>>({});

  const groups = data.orders[role];
  const skillsById = useMemo(
    () => new Map(data.skills.map((s) => [s.id, s])),
    [data.skills],
  );
  const byGroup = useMemo(() => {
    const map = new Map<SkillGroup, SkillView[]>();
    for (const s of data.skills)
      map.set(s.group, [...(map.get(s.group) ?? []), s]);
    return map;
  }, [data.skills]);

  const selected = selectedId ? (skillsById.get(selectedId) ?? null) : null;
  const group =
    pick && pick.role === role && groups.includes(pick.group)
      ? pick.group
      : groups[0];
  const evidence = selected?.evidence ?? NO_EVIDENCE;
  const cardIds = evidence.map((e) => e.anchor);
  const cardKey = cardIds.join("|");

  // The real #exp-* / #proj-* cards elsewhere on the page glow while their skill is selected.
  useEffect(() => {
    setIds(cardKey ? cardKey.split("|") : []);
    return () => setIds([]);
  }, [cardKey, setIds]);

  function selectSkill(skill: SkillView) {
    setActiveCard(null);
    if (selectedId === skill.id) {
      setSelectedId(null);
      return;
    }
    setSelectedId(skill.id);
    setPick({ role, group: skill.group });
  }

  const layoutKey = `${role}:${groups.join(",")}`;
  const tabStop = (g: SkillGroup, list: SkillView[]) => {
    const wanted =
      rove[g] ??
      (selectedId && list.some((x) => x.id === selectedId) ? selectedId : null);
    return list.some((x) => x.id === wanted) ? wanted : (list[0]?.id ?? null);
  };

  /** Arrow keys, Home and End move between the chips of one group. */
  function onChipKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const step = ARROW_STEP[e.key];
    if (step === undefined && e.key !== "Home" && e.key !== "End") return;
    const chips = [
      ...(e.currentTarget
        .closest("ul")
        ?.querySelectorAll<HTMLButtonElement>("[data-skill-chip]") ?? []),
    ];
    const at = chips.indexOf(e.currentTarget);
    if (at < 0) return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? chips.length - 1
          : (at + (step ?? 0) + chips.length) % chips.length;
    chips[next]?.focus();
  }

  const identity = `${data.name} — ${data.titles[role]}`;
  const terminalSkills = (byGroup.get(group) ?? []).map((s) => s.name);

  return (
    <div ref={containerRef} className="relative mt-12">
      {selected && evidence.length > 0 && (
        <SkillBeams
          containerRef={containerRef}
          skillId={selected && evidence.length > 0 ? selected.id : null}
          getChip={getChip}
          cardIds={cardIds}
          getCard={getCard}
          activeCardId={activeCard}
          layoutKey={layoutKey}
          reduced={reduced}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-12">
        <div className="xl:sticky xl:top-20 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-start">
          <SkillTerminal
            label={t("terminal")}
            identity={identity}
            group={group}
            skills={terminalSkills}
          />
        </div>

        <div
          role="group"
          aria-label={t("groupsLabel")}
          className="skill-fall relative flex flex-col gap-7 pl-6 xl:col-start-1 xl:row-span-2 xl:row-start-1"
        >
          {groups.map((g, index) => {
            const active = g === group;
            const list = byGroup.get(g) ?? [];
            return (
              <div
                key={g}
                data-skill-group={g}
                data-active={active ? "true" : undefined}
                data-scene-avoid="box"
                data-scene-veil="off"
                className="relative isolate"
              >
                {/* This background scrolls natively with its group, never a frame behind in the fixed scene overlay. */}
                <div
                  data-skill-surface=""
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-x-4 -inset-y-3 -z-10 rounded-2xl border border-border bg-card shadow-sm"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-[0.6rem] -left-[1.72rem] size-2.5 rounded-full border border-border bg-background transition-all duration-300",
                    active &&
                      "scale-125 border-(--role-accent) bg-(--role-accent) shadow-[0_0_12px_var(--role-accent)]",
                  )}
                />
                <h3 className="mb-3">
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => setPick({ role, group: g })}
                    className={clsx(
                      "group/head inline-flex cursor-pointer items-baseline gap-3 rounded-md py-0.5 text-left font-heading text-lg font-semibold tracking-tight transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      active
                        ? "text-foreground"
                        : "text-foreground/60 hover:text-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={clsx(
                        "font-mono text-xs font-medium tabular-nums",
                        active
                          ? "text-(--role-accent-text)"
                          : "text-muted-foreground",
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {t(`groups.${g}`)}
                    <span
                      aria-hidden="true"
                      className="font-mono text-xs font-normal text-muted-foreground tabular-nums"
                    >
                      {list.length}
                    </span>
                  </button>
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {list.map((skill) => {
                    const pressed = skill.id === selectedId;
                    return (
                      <li key={skill.id}>
                        <button
                          type="button"
                          data-skill-chip=""
                          data-skill-name={skill.name}
                          aria-pressed={pressed}
                          aria-controls="skills-evidence"
                          tabIndex={skill.id === tabStop(g, list) ? 0 : -1}
                          onFocus={() =>
                            setRove((r) =>
                              r[g] === skill.id ? r : { ...r, [g]: skill.id },
                            )
                          }
                          onKeyDown={onChipKeyDown}
                          onClick={() => selectSkill(skill)}
                          ref={(el) => {
                            if (el) chipRefs.current.set(skill.id, el);
                            else chipRefs.current.delete(skill.id);
                          }}
                          style={
                            {
                              "--sk-hex": skill.icon?.hex,
                              "--sk-hex-dark": skill.icon?.hexDark,
                            } as CSSProperties
                          }
                          className="skill-chip inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-left text-sm text-foreground/85 backdrop-blur-sm transition-[color,border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:border-(--role-accent) aria-pressed:bg-(--role-accent)/10 aria-pressed:text-foreground aria-pressed:shadow-[0_8px_24px_-12px_var(--role-accent)]"
                        >
                          {skill.icon ? (
                            <SkillGlyph skillId={skill.id} />
                          ) : (
                            <SkillMonogram letters={skill.monogram} />
                          )}
                          <span>{skill.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <section
          id="skills-evidence"
          aria-label={t("evidence")}
          data-selected={selected ? "true" : undefined}
          data-scene-avoid="box"
          data-scene-veil="off"
          className={cn(
            "skill-evidence min-w-0 rounded-xl border border-border bg-card p-4 xl:sticky xl:top-[23.9rem] xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:mt-[18.9rem] xl:max-h-[calc(100vh-25rem)] xl:self-start xl:overflow-y-auto",
            selected &&
              "max-xl:sticky max-xl:bottom-[5.5rem] max-xl:z-20 max-xl:max-h-[48vh] max-xl:overflow-y-auto lg:max-xl:bottom-4",
            selected && "border-(--role-accent)/40",
          )}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              {t("evidence")}
            </p>
            {selected ? (
              <p className="font-mono text-xs text-muted-foreground tabular-nums">
                {t("linked", { count: evidence.length })}
              </p>
            ) : null}
          </div>

          {selected ? (
            <>
              <h3 className="mt-1.5 font-heading text-lg leading-snug font-semibold">
                {t("evidenceTitle", { skill: selected.name })}
              </h3>
              {evidence.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("noEvidence")}
                </p>
              ) : (
                <ul key={selected.id} className="mt-3 flex flex-col gap-2">
                  {evidence.map((item, i) => (
                    <li
                      key={item.anchor}
                      data-evidence-card=""
                      data-kind={item.kind}
                      ref={(el) => {
                        if (el) cardRefs.current.set(item.anchor, el);
                        else cardRefs.current.delete(item.anchor);
                      }}
                      style={{ animationDelay: `${i * 70}ms` }}
                      className="skill-card-in"
                    >
                      <a
                        href={`#${item.anchor}`}
                        onMouseEnter={() => setActiveCard(item.anchor)}
                        onMouseLeave={() => setActiveCard(null)}
                        onFocus={() => setActiveCard(item.anchor)}
                        onBlur={() => setActiveCard(null)}
                        className="block rounded-lg border border-border bg-background/50 px-3 py-2 transition-colors hover:border-(--role-accent)/60 hover:bg-(--role-accent)/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <span className="block text-[10px] font-semibold tracking-[0.18em] text-(--role-accent-text) uppercase">
                          {item.kind === "exp"
                            ? t("kindExperience")
                            : t("kindProject")}
                        </span>
                        <span className="block text-sm leading-snug font-semibold">
                          {item.title}
                        </span>
                        <span className="block text-xs leading-snug text-muted-foreground">
                          {item.role} · {item.period}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("evidenceHint")}
            </p>
          )}
        </section>

        <p aria-live="polite" className="sr-only">
          {selected
            ? `${selected.name} — ${t("linked", { count: evidence.length })}`
            : ""}
        </p>
      </div>
    </div>
  );
}
