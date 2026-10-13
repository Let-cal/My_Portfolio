"use client";

import { animate } from "motion/react";
import { Slot } from "radix-ui";
import { useRef, type ComponentProps, type PointerEvent } from "react";
import { usePrefersReducedMotion } from "./use-media-query";
import { usePointerFine } from "./use-pointer-fine";

const MAX_OFFSET_PX = 12;
const SPRING = { type: "spring", stiffness: 260, damping: 18, mass: 0.4 } as const;

type MagneticButtonProps = ComponentProps<"button"> & {
  /** Fraction of the pointer's distance from the centre the button follows (capped at 12px). */
  strength?: number;
  asChild?: boolean;
};

/**
 * Button that leans towards the pointer (at most 12px) and springs back on leave. The offset is applied
 * through a motion animation on the element itself, so there is no React state per mouse move. Without a
 * fine pointer (touch) or with reduced motion the element is never transformed.
 */
export function MagneticButton({ strength = 0.35, asChild = false, onPointerMove, onPointerLeave, ref, ...rest }: MagneticButtonProps) {
  const fine = usePointerFine();
  const reduced = usePrefersReducedMotion();
  const active = fine && !reduced;
  const innerRef = useRef<HTMLButtonElement | null>(null);

  function setRef(node: HTMLButtonElement | null) {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }

  function handleMove(e: PointerEvent<HTMLButtonElement>) {
    onPointerMove?.(e);
    const el = innerRef.current;
    if (!active || !el || e.pointerType === "touch") return;
    const rect = el.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) * strength;
    const dy = (e.clientY - (rect.top + rect.height / 2)) * strength;
    const dist = Math.hypot(dx, dy);
    const k = dist > MAX_OFFSET_PX ? MAX_OFFSET_PX / dist : 1;
    animate(el, { x: dx * k, y: dy * k }, SPRING);
  }

  function handleLeave(e: PointerEvent<HTMLButtonElement>) {
    onPointerLeave?.(e);
    const el = innerRef.current;
    if (!active || !el) return;
    animate(el, { x: 0, y: 0 }, SPRING);
  }

  const Comp = asChild ? Slot.Root : "button";
  return <Comp {...rest} ref={setRef} onPointerMove={handleMove} onPointerLeave={handleLeave} />;
}
