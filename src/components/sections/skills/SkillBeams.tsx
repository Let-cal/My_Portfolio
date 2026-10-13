"use client";

import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import { beamPath } from "./beam-geometry";

type Beam = { id: string; d: string };

type SkillBeamsProps = {
  /** Element the SVG overlays (`position: relative`); path coordinates are relative to its top-left. */
  containerRef: RefObject<HTMLElement | null>;
  /** The selected skill, or null for no beams. */
  skillId: string | null;
  getChip: (skillId: string) => HTMLElement | null;
  /** Ids of the evidence cards, in panel order. */
  cardIds: string[];
  getCard: (cardId: string) => HTMLElement | null;
  /** The card under the pointer or focus: its beam brightens, the others dim. */
  activeCardId: string | null;
  reduced: boolean;
};

/**
 * Animated beams (S1) from the selected skill chip to each of its evidence cards. One `<path>` per card. Geometry is
 * measured from the live layout, so it is re-measured on scroll (the evidence panel is sticky), resize and when the
 * container changes size. Measuring happens in animation-frame callbacks and never during render. Under reduced motion
 * the beams are drawn at once and nothing travels along them.
 */
export function SkillBeams({ containerRef, skillId, getChip, cardIds, getCard, activeCardId, reduced }: SkillBeamsProps) {
  const [measured, setMeasured] = useState<{ skillId: string; beams: Beam[] } | null>(null);
  const cardKey = cardIds.join("|");

  useEffect(() => {
    const container = containerRef.current;
    if (!skillId || !container || cardKey === "") return;
    const ids = cardKey.split("|");
    let frame = 0;
    let settle = 0;

    const measure = () => {
      frame = 0;
      const chip = getChip(skillId);
      if (!chip) return;
      const origin = container.getBoundingClientRect();
      const from = chip.getBoundingClientRect();
      const beams: Beam[] = [];
      for (const id of ids) {
        const card = getCard(id);
        if (card) beams.push({ id, d: beamPath(from, card.getBoundingClientRect(), origin) });
      }
      setMeasured((prev) =>
        prev && prev.skillId === skillId && prev.beams.length === beams.length && prev.beams.every((b, i) => b.d === beams[i].d)
          ? prev
          : { skillId, beams },
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    schedule();
    // Cards fade in and the panel may reflow right after a selection: measure once more when things settle.
    settle = window.setTimeout(schedule, 350);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [containerRef, skillId, cardKey, getChip, getCard]);

  if (!skillId || !measured || measured.skillId !== skillId || measured.beams.length === 0) return null;

  return (
    <svg
      key={skillId}
      data-beam=""
      aria-hidden="true"
      focusable="false"
      className="skill-beams pointer-events-none absolute inset-0 z-30 size-full overflow-visible"
    >
      {measured.beams.map(({ id, d }, i) => {
        const state = activeCardId === null ? undefined : activeCardId === id ? "active" : "dim";
        return (
          <g key={id} data-state={state} style={{ "--beam-delay": `${i * 90}ms` } as CSSProperties}>
            <path d={d} pathLength={1} className="skill-beam" />
            {reduced ? null : (
              <circle r="3" className="skill-beam-spark" opacity="0">
                <animateMotion dur="2.4s" begin={`${0.9 + i * 0.2}s`} repeatCount="indefinite" path={d} />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.88;1" dur="2.4s" begin={`${0.9 + i * 0.2}s`} repeatCount="indefinite" />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}
