"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import {
  useMediaQuery,
  usePrefersReducedMotion,
} from "@/components/fx/use-media-query";
import { usePointerFine } from "@/components/fx/use-pointer-fine";

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
export function WhyCardFrame({ children }: { children: ReactNode }) {
  const fine = usePointerFine();
  const reduced = usePrefersReducedMotion();
  const narrow = useMediaQuery("(max-width: 640px)");
  const tiltOn = fine && !reduced && !narrow;
  const ref = useRef<HTMLElement>(null);
  const frame = useRef(0);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

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

  return (
    <article
      ref={ref}
      data-why-card=""
      // The whole card is protected, not just its lines of text: the creature stages its change on open water beside it.
      data-scene-avoid="box"
      // Its existing opaque gradient protects the text; suppress only the redundant external veil.
      data-scene-veil="off"
      data-tilt={tiltOn ? "true" : undefined}
      className="why-card relative h-[500px] w-[78vw] max-w-[300px] cursor-default select-none text-black"
      onPointerEnter={handleEnter}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      {children}
    </article>
  );
}
