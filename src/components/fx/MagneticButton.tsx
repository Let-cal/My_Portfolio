"use client";

import type { animate } from "motion";
import * as Slot from "@radix-ui/react-slot";
import {
  useEffect,
  useRef,
  type ComponentProps,
  type PointerEvent,
} from "react";
import { loadAnimate } from "@/lib/load-animate";
import { usePrefersReducedMotion } from "./use-media-query";
import { usePointerFine } from "./use-pointer-fine";

const MAX_OFFSET_PX = 12;
const SPRING = {
  type: "spring",
  stiffness: 260,
  damping: 18,
  mass: 0.4,
} as const;

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
export function MagneticButton({
  strength = 0.35,
  asChild = false,
  onPointerMove,
  onPointerLeave,
  ref,
  ...rest
}: MagneticButtonProps) {
  const fine = usePointerFine();
  const reduced = usePrefersReducedMotion();
  const active = fine && !reduced;
  const innerRef = useRef<HTMLButtonElement | null>(null);
  const revision = useRef(0);
  const controls = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    const generation = revision;
    if (!active && innerRef.current) innerRef.current.style.transform = "";
    return () => {
      generation.current++;
      controls.current?.stop();
    };
  }, [active]);

  function move(el: HTMLButtonElement, x: number, y: number) {
    const request = ++revision.current;
    void loadAnimate()
      .then((animate) => {
        if (request !== revision.current || innerRef.current !== el) return;
        controls.current?.stop();
        controls.current = animate(el, { x, y }, SPRING);
      })
      .catch(() => {
        if (request === revision.current)
          el.style.transform = `translate(${x}px, ${y}px)`;
      });
  }

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
    move(el, dx * k, dy * k);
  }

  function handleLeave(e: PointerEvent<HTMLButtonElement>) {
    onPointerLeave?.(e);
    const el = innerRef.current;
    if (!active || !el) return;
    move(el, 0, 0);
  }

  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      {...rest}
      ref={setRef}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    />
  );
}
