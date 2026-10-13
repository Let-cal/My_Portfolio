"use client";

import { ArrowRightIcon } from "lucide-react";
import { useEffect, useRef, type PointerEvent } from "react";
import { NumberTicker } from "@/components/fx/NumberTicker";
import { useMediaQuery, usePrefersReducedMotion } from "@/components/fx/use-media-query";
import { usePointerFine } from "@/components/fx/use-pointer-fine";
import { WaveBackground } from "./WaveBackground";

/** A why-card with every string already picked for the current locale. */
export type WhyCardView = {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  body: string;
  colors: [string, string];
  /** `#exp-<id>` / `#proj-<id>`, or null for no evidence link. */
  evidenceLink: string | null;
  stat: { value: number; prefix?: string; suffix?: string; label: string } | null;
};

/** Greatest tilt in either axis, in degrees. */
const MAX_TILT_DEG = 8;
const round3 = (n: number) => String(Number(n.toFixed(3)));

/**
 * One card of the Why Hire Me carousel, rebuilt from the old site: a two-colour gradient with layered SVG waves,
 * a drawn frame and three depth layers. On a mouse (and above 640px) it tilts up to 8 degrees towards the pointer and
 * the waves drift by up to 20px; both are CSS variables written from requestAnimationFrame, never React state.
 * Touch, narrow screens and reduced motion get a still card. Text is always dark on the gradient/white waves, so it
 * reads the same in the dark and light themes.
 */
export function WhyCard({ card, evidenceLabel }: { card: WhyCardView; evidenceLabel: string }) {
  const fine = usePointerFine();
  const reduced = usePrefersReducedMotion();
  const narrow = useMediaQuery("(max-width: 640px)");
  const tiltOn = fine && !reduced && !narrow;
  const ref = useRef<HTMLElement>(null);
  const frame = useRef(0);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(touchTimer.current);
    },
    [],
  );

  function setHover(on: boolean) {
    const el = ref.current;
    if (!el) return;
    if (on) el.setAttribute("data-hover", "true");
    else el.removeAttribute("data-hover");
  }

  function resetTilt() {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty("--why-rx", "0deg");
    el.style.setProperty("--why-ry", "0deg");
    el.style.setProperty("--why-tx", "0");
    el.style.setProperty("--why-ty", "0");
  }

  function handleEnter(e: PointerEvent<HTMLElement>) {
    if (e.pointerType !== "touch") setHover(true);
  }

  function handleMove(e: PointerEvent<HTMLElement>) {
    const el = ref.current;
    if (!tiltOn || !el || e.pointerType === "touch") return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = (clientX - rect.left) / rect.width - 0.5;
      const ny = (clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty("--why-tx", round3(nx));
      el.style.setProperty("--why-ty", round3(ny));
      el.style.setProperty("--why-rx", `${round3(ny * 2 * MAX_TILT_DEG)}deg`);
      el.style.setProperty("--why-ry", `${round3(nx * -2 * MAX_TILT_DEG)}deg`);
    });
  }

  function handleLeave(e: PointerEvent<HTMLElement>) {
    if (e.pointerType === "touch") return;
    setHover(false);
    resetTilt();
  }

  // Touch: light the card up while it is pressed, and a moment after (the old site did the same).
  function handleDown(e: PointerEvent<HTMLElement>) {
    if (e.pointerType !== "touch") return;
    clearTimeout(touchTimer.current);
    setHover(true);
  }
  function handleUp(e: PointerEvent<HTMLElement>) {
    if (e.pointerType !== "touch") return;
    clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => setHover(false), 400);
  }

  const { stat } = card;

  return (
    <article
      ref={ref}
      data-why-card=""
      data-tilt={tiltOn ? "true" : undefined}
      className="why-card relative h-[500px] w-[78vw] max-w-[300px] cursor-default select-none text-black"
      onPointerEnter={handleEnter}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      <div className="why-layer why-layer-0 absolute inset-0 overflow-hidden rounded-md shadow-[0_14px_30px_-16px_rgb(0_0_0/0.55)]">
        <WaveBackground colors={card.colors} />
      </div>

      <div aria-hidden="true" className="why-layer why-layer-1 pointer-events-none absolute inset-0 z-30">
        <svg viewBox="0 0 300 400" preserveAspectRatio="none" className="h-full w-full" focusable="false">
          <path
            className="why-frame"
            d="M 20,20 H 280 V 380 H 20 Z"
            pathLength={1}
            fill="none"
            stroke="rgba(0,0,0,0.8)"
            strokeWidth={1}
           
          />
        </svg>
      </div>

      <div className="why-layer why-layer-2 absolute inset-0 z-20 flex flex-col p-8 pb-9">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="why-meta-line h-px w-10 bg-black" />
          <span className="why-meta-text font-mono text-xs font-medium tracking-wider uppercase">{card.tag}</span>
        </div>

        {stat && (
          <div className="mt-5">
            <NumberTicker
              value={stat.value}
              prefix={stat.prefix}
              suffix={stat.suffix}
              className="font-heading text-6xl leading-none font-extrabold tracking-tight"
            />
            <p data-stat-label="" className="mt-2 max-w-[85%] text-xs leading-snug font-medium [word-break:auto-phrase]">
              {stat.label}
            </p>
          </div>
        )}

        <div className="mt-auto">
          <h3 className="why-title font-heading text-[22px] leading-[1.15] font-extrabold tracking-tight [word-break:auto-phrase]">{card.title}</h3>
          <p className="why-subtitle mt-2 text-xs font-medium tracking-wider uppercase">{card.subtitle}</p>
          <p className="mt-4 text-[13px] leading-[1.55] [word-break:auto-phrase]">{card.body}</p>
          {card.evidenceLink && (
            <a
              href={card.evidenceLink}
              draggable={false}
              className="mt-4 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold underline decoration-black/40 underline-offset-4 outline-offset-4 hover:decoration-black focus-visible:outline-2 focus-visible:outline-black"
            >
              {evidenceLabel}
              <ArrowRightIcon aria-hidden="true" className="size-4" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
