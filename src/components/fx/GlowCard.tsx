"use client";

import {
  useEffect,
  useRef,
  type ComponentProps,
  type PointerEvent,
} from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-media-query";
import { usePointerFine } from "./use-pointer-fine";

type GlowCardProps = ComponentProps<"div"> & {
  /** Tilt towards the pointer in 3D. */
  tilt?: boolean;
  maxTiltDeg?: number;
};

/**
 * Card with a border that lights up around the pointer (`--gx/--gy` feed a pseudo-element in globals.css,
 * selected by `data-glow-card`) and an optional 3D tilt. Pointer coordinates go to CSS variables from a
 * requestAnimationFrame callback, never into React state. Touch devices and reduced motion get a plain card.
 */
export function GlowCard({
  tilt = false,
  maxTiltDeg = 6,
  className,
  style,
  children,
  ref,
  onPointerMove,
  onPointerLeave,
  ...rest
}: GlowCardProps) {
  const fine = usePointerFine();
  const reduced = usePrefersReducedMotion();
  const active = fine && !reduced;
  const innerRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function setRef(node: HTMLDivElement | null) {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }

  function handleMove(e: PointerEvent<HTMLDivElement>) {
    onPointerMove?.(e);
    const el = innerRef.current;
    if (!active || !el || e.pointerType === "touch") return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      el.style.setProperty("--gx", `${x}px`);
      el.style.setProperty("--gy", `${y}px`);
      if (tilt && rect.width > 0 && rect.height > 0) {
        el.style.setProperty(
          "--tilt-y",
          `${((x / rect.width - 0.5) * 2 * maxTiltDeg).toFixed(2)}deg`,
        );
        el.style.setProperty(
          "--tilt-x",
          `${(-(y / rect.height - 0.5) * 2 * maxTiltDeg).toFixed(2)}deg`,
        );
      }
    });
  }

  function handleLeave(e: PointerEvent<HTMLDivElement>) {
    onPointerLeave?.(e);
    const el = innerRef.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  }

  return (
    <div
      {...rest}
      ref={setRef}
      data-glow-card=""
      className={cn(className)}
      style={
        active && tilt
          ? {
              ...style,
              transform:
                "perspective(900px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
              transition: "transform 200ms ease-out",
            }
          : style
      }
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {children}
    </div>
  );
}
