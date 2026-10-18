"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
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
  /** Changes whenever the chips move without the container resizing (role change reorders the groups). */
  layoutKey: string;
  reduced: boolean;
};

/**
 * Animated beams (S1) from the selected skill chip to each of its evidence cards. One `<path>` per card.
 * Geometry is measured from the live layout in animation-frame callbacks (never during render) whenever something
 * could have moved it: scroll anywhere (the evidence panel is sticky and may scroll inside itself), resize, a change of
 * the chip/card/container size, web fonts finishing, or a new `layoutKey`. React state only holds *which* beams exist;
 * the path strings are written straight to the SVG elements, so scrolling does not re-render the component.
 * Under reduced motion the beams are drawn at once and nothing travels along them.
 */
export function SkillBeams({ containerRef, skillId, getChip, cardIds, getCard, activeCardId, layoutKey, reduced }: SkillBeamsProps) {
  /** The beams currently drawn; `d` here is only the first geometry, later ones go to the DOM directly. */
  const [shown, setShown] = useState<{ skillId: string; beams: Beam[] } | null>(null);
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const motionRefs = useRef(new Map<string, SVGElement>());
  const cardKey = cardIds.join("|");

  useEffect(() => {
    const container = containerRef.current;
    if (!skillId || !container || cardKey === "") return;
    const ids = cardKey.split("|");
    let frame = 0;
    let settle = 0;
    let cancelled = false;

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
      for (const { id, d } of beams) {
        pathRefs.current.get(id)?.setAttribute("d", d);
        motionRefs.current.get(id)?.setAttribute("path", d);
      }
      const key = beams.map((b) => b.id).join("|");
      setShown((prev) =>
        prev && prev.skillId === skillId && prev.beams.map((b) => b.id).join("|") === key ? prev : { skillId, beams },
      );
    };
    const schedule = () => {
      if (!frame && !cancelled) frame = requestAnimationFrame(measure);
    };

    schedule();
    // Cards fade in and the panel may reflow right after a selection: measure once more when things settle.
    settle = window.setTimeout(schedule, 350);
    // Capture: also hears the evidence panel (and any other box) scrolling inside itself.
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    void document.fonts?.ready.then(schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (observer) {
      observer.observe(container);
      const chipEl = getChip(skillId);
      if (chipEl) observer.observe(chipEl);
      for (const id of ids) {
        const card = getCard(id);
        if (card) observer.observe(card);
      }
    }
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [containerRef, skillId, cardKey, getChip, getCard, layoutKey]);

  if (!skillId || !shown || shown.skillId !== skillId || shown.beams.length === 0) return null;

  return (
    <svg
      key={skillId}
      data-beam=""
      aria-hidden="true"
      focusable="false"
      className="skill-beams pointer-events-none absolute inset-0 z-30 size-full overflow-visible"
    >
      {shown.beams.map(({ id, d }, i) => {
        const state = activeCardId === null ? undefined : activeCardId === id ? "active" : "dim";
        return (
          <g key={id} data-state={state} style={{ "--beam-delay": `${i * 90}ms` } as CSSProperties}>
            <path
              d={d}
              pathLength={1}
              className="skill-beam"
              ref={(el) => {
                if (el) pathRefs.current.set(id, el);
                else pathRefs.current.delete(id);
              }}
            />
            {reduced ? null : (
              <circle r="3" className="skill-beam-spark" opacity="0">
                <animateMotion
                  dur="2.4s"
                  begin={`${0.9 + i * 0.2}s`}
                  repeatCount="indefinite"
                  path={d}
                  ref={(el) => {
                    if (el) motionRefs.current.set(id, el);
                    else motionRefs.current.delete(id);
                  }}
                />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.88;1" dur="2.4s" begin={`${0.9 + i * 0.2}s`} repeatCount="indefinite" />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}
