import type { ProjectKind } from "@/content/schema";
import { cn } from "@/lib/utils";
import "./kinds.css";

/**
 * Decorative kanji name of each project kind (docs/superpowers/specs/2026-11-06-kamon-project-kinds-design.md).
 * Shown beside the localized label outside the Japanese locale, whose labels are already Japanese.
 */
export const KIND_KANJI: Record<ProjectKind, string> = {
  work: "仕事",
  university: "学び",
  personal: "個人",
};

/**
 * The crest (家紋) of a project kind: waves for work, sakura for university, a koi for personal. A CSS mask
 * painted in `currentColor` (kinds.css), so it costs no script and follows the text colour. Always next to the
 * kind's text, never its only label.
 */
export function Kamon({
  kind,
  className,
}: {
  kind: ProjectKind;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-kind={kind}
      className={cn("kamon", className)}
    />
  );
}
