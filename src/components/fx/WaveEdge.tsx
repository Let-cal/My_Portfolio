import { cn } from "@/lib/utils";

/** Two periods of a sine-like wave in a 2880x48 box; the CSS animation slides it by exactly one period (-50%). */
const PATH = "M0 24 C240 0 480 0 720 24 S1200 48 1440 24 S1920 0 2160 24 S2640 48 2880 24 V48 H0 Z";

/**
 * 48px wave divider between sections. Fill comes from `currentColor`, so set a text colour on a parent or
 * via className. The 12s drift is a CSS animation that stops under prefers-reduced-motion.
 */
export function WaveEdge({ flip = false, className }: { flip?: boolean; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none h-12 w-full overflow-hidden", flip && "-scale-y-100", className)}>
      <svg className="fx-wave h-12 w-[200%] fill-current" viewBox="0 0 2880 48" preserveAspectRatio="none" focusable="false">
        <path d={PATH} />
      </svg>
    </div>
  );
}
