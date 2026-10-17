import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The paper-lantern silhouette shared by certificates and activities: a cord, a top cap, the body that holds the
 * content, a bottom cap and a tassel. The whole lantern bobs on its cord (CSS, staggered by `index`; paused on
 * hover, focus and while flipped; off under reduced motion). Hover and focus light the body in the role accent.
 * Pure markup: no state, so it can sit in a server or a client tree.
 */
export function LanternFrame({
  index,
  flipped = false,
  className,
  children,
}: {
  /** Position in the list; spreads the phase and period of the bob so neighbours never move together. */
  index: number;
  flipped?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const style = {
    "--bob-delay": `${-((index * 1.37) % 6).toFixed(2)}s`,
    "--bob-dur": `${(5.4 + (index % 4) * 0.7).toFixed(1)}s`,
  } as CSSProperties;
  return (
    <div className={cn("lantern-scene", className)} data-flipped={flipped ? "" : undefined}>
      <div className="lantern-bob" style={style}>
        <span aria-hidden="true" className="lantern-cord" />
        <span aria-hidden="true" className="lantern-cap" />
        <div className="lantern-body">{children}</div>
        <span aria-hidden="true" className="lantern-cap" />
        <span aria-hidden="true" className="lantern-tassel" />
      </div>
    </div>
  );
}
