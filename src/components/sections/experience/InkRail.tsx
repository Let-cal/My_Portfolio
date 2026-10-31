/** A slight sway down the column; the viewBox is stretched to the tree's height. */
const D = "M14 0C10 120 18 240 13 380S16 640 14 760 12 900 14 1000";

/**
 * The tree's ink rail (spec 5.2 B6): one wavering SVG stroke, and a duplicate koi-to-teal stroke that fills down as
 * the reader scrolls through the tree. The fill is the `[data-beam-path]` the shared scroll engine drives
 * (`useScrollEnhancement(…, "beam")`, loaded near the viewport): it writes the dash offset once per frame from the
 * tree's scroll progress, top at 70% of the viewport to bottom at 50%. Under reduced motion nothing attaches and
 * journey.css draws the rail in full.
 */
export function InkRail() {
  return (
    <svg
      aria-hidden="true"
      className="jt-rail"
      viewBox="0 0 28 1000"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient
          id="jt-ink"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="0"
          y2="1000"
        >
          <stop offset="0" stopColor="#f07a2a" />
          <stop offset="1" stopColor="#3fb8a9" />
        </linearGradient>
      </defs>
      <path className="jt-rail-track" d={D} />
      <path
        data-beam-path=""
        className="jt-rail-fill"
        d={D}
        pathLength={1}
        stroke="url(#jt-ink)"
        strokeDasharray="1 1"
        strokeDashoffset={1}
      />
    </svg>
  );
}
