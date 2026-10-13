"use client";

import { KineticText } from "@/components/fx/KineticText";
import { useRevealOnView } from "@/components/fx/use-reveal-on-view";

/**
 * The giant contact headline. Its letters rise in with `KineticText`, but only once the heading scrolls into
 * view (the section sits at the very bottom of the page, so an entrance on load would be wasted). Until the
 * observer has measured it, the letters play as usual, so nothing stays hidden without JS. Once measured
 * off-screen, `data-held` pauses the animation (see globals.css) and the letters are re-created so they start
 * from their hidden pose; entering the viewport lets them run.
 */
export function ContactHeadline({ id, text, className }: { id: string; text: string; className?: string }) {
  const { ref, armed, shown } = useRevealOnView<HTMLHeadingElement>(0.3);
  return (
    <h2 id={id} ref={ref} className={className} data-contact-headline="" data-held={armed && !shown ? "" : undefined}>
      <KineticText key={armed ? "armed" : "initial"} text={text} staggerMs={30} />
    </h2>
  );
}
