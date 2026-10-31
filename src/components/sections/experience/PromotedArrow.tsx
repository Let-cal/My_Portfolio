/**
 * The up-arrow that marks a promotion, on the tree's connector and on the Gantt's tick. Drawn as SVG so no arrow
 * glyph enters the source (the site's font subsets are cut to the characters the source uses).
 */
export function PromotedArrow() {
  return (
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
  );
}
