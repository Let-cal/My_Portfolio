import { cn } from "@/lib/utils";

/** Id of the `<symbol>` the Skills section defines once for a skill's brand glyph. */
export const glyphId = (skillId: string) => `skill-icon-${skillId}`;

/**
 * A brand glyph drawn from the section's SVG sprite. It takes the text colour (`fill: currentColor`), which is grey
 * until the chip is hovered, focused or selected (globals.css, `.skill-chip`).
 */
export function SkillGlyph({ skillId, className }: { skillId: string; className?: string }) {
  return (
    <svg data-skill-icon="" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="currentColor" className={cn("size-4 shrink-0", className)}>
      <use href={`/images/skill-sprite.svg#${glyphId(skillId)}`} />
    </svg>
  );
}

/** Tile for a skill without a brand glyph: its first letters in a small rounded square. */
export function SkillMonogram({ letters, className }: { letters: string; className?: string }) {
  return (
    <span
      data-skill-monogram=""
      aria-hidden="true"
      className={cn("grid size-4 shrink-0 place-items-center rounded-[4px] bg-current/15 font-mono text-[8px] leading-none font-bold tracking-tight", className)}
    >
      <span className="text-current">{letters}</span>
    </span>
  );
}
