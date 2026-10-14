"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useId, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { ROLE_KEYS } from "@/content/constants";
import type { RoleKey } from "@/content/schema";
import { ROLE_ACCENT, SECTOR_FROM, WHEEL_ORDER, angleFromPoint, sectorForAngle } from "@/lib/role-accent";
import { cn } from "@/lib/utils";
import { ROLE_IMAGE, RoleStageProvider, useOptionalStage, useStage } from "./stage-context";

/** Ring geometry in the 440×440 viewBox: arc radius, gap at each arc end (degrees). */
export const WHEEL_VIEWBOX = 440;
const C = WHEEL_VIEWBOX / 2;
export const ARC_RADIUS = 208;
const GAP = 7;
const SWIPE_PX = 40;
const SIZES = "(min-width: 1024px) 440px, min(360px, 80vw)";

/** Point on a circle around the wheel centre at a CSS angle (0° = top, clockwise). */
export function wheelPoint(deg: number, r = ARC_RADIUS): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function arcPath(a0: number, a1: number, r = ARC_RADIUS, sweepFlag = 1) {
  const [x0, y0] = wheelPoint(a0, r);
  const [x1, y1] = wheelPoint(a1, r);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 ${sweepFlag} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const step = (key: RoleKey, by: number) => WHEEL_ORDER[(WHEEL_ORDER.indexOf(key) + by + WHEEL_ORDER.length) % WHEEL_ORDER.length];

const ARROWS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Circular portrait split into the three role slices, with an SVG ring of three arcs (the radiogroup).
 * Works on its own (it then creates its own stage) or inside RoleStage next to RolePanels.
 */
export function RoleWheel({ className }: { className?: string }) {
  return useOptionalStage() ? (
    <WheelView className={className} />
  ) : (
    <RoleStageProvider>
      <WheelView className={className} />
    </RoleStageProvider>
  );
}

function WheelView({ className }: { className?: string }) {
  const t = useTranslations("hero");
  const { role, base, active, peekRole, reduced, setHover, select, peekRef, baseImgRef } = useStage();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const radios = useRef<Partial<Record<RoleKey, SVGGElement | null>>>({});
  const discRef = useRef<HTMLDivElement | null>(null);
  const pointer = useRef<{ type: string; x: number; swiped: boolean }>({ type: "mouse", x: 0, swiped: false });

  function choose(key: RoleKey, focus = false) {
    select(key);
    if (focus) radios.current[key]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    const by = ARROWS[e.key];
    if (!by) return;
    e.preventDefault();
    choose(step(role, by), true);
  }

  function sectorAt(clientX: number, clientY: number): RoleKey | null {
    const el = discRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return null;
    return sectorForAngle(angleFromPoint(clientX, clientY, r.left + r.width / 2, r.top + r.height / 2));
  }

  function onDiscMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch") return;
    const key = sectorAt(e.clientX, e.clientY);
    if (key) setHover(key);
  }

  function onDiscDown(e: PointerEvent<HTMLDivElement>) {
    pointer.current = { type: e.pointerType, x: e.clientX, swiped: false };
  }

  function onDiscUp(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    const dx = e.clientX - pointer.current.x;
    if (Math.abs(dx) > SWIPE_PX) {
      pointer.current.swiped = true;
      choose(step(role, dx < 0 ? 1 : -1));
    }
  }

  function onDiscClick(e: { clientX: number; clientY: number }) {
    if (pointer.current.swiped) {
      pointer.current.swiped = false;
      return;
    }
    const key = sectorAt(e.clientX, e.clientY) ?? step(role, 1);
    // Touch: tapping the chosen role's slice moves on to the next role; a mouse click on it does nothing.
    if (key === role && pointer.current.type === "touch") choose(step(role, 1));
    else choose(key);
  }

  return (
    <div
      data-role-wheel=""
      className={cn("hero-wheel", className)}
      onPointerLeave={(e) => e.pointerType !== "touch" && setHover(null)}
    >
      <div
        ref={discRef}
        className="hero-disc"
        onPointerMove={onDiscMove}
        onPointerLeave={(e) => e.pointerType !== "touch" && setHover(null)}
        onPointerDown={onDiscDown}
        onPointerUp={onDiscUp}
        onClick={onDiscClick}
      >
        <div data-layer="base" className="hero-layer">
          <Image
            ref={baseImgRef}
            src={ROLE_IMAGE[base]}
            alt={t(`wheel.alt.${base}`)}
            fill
            sizes={SIZES}
            fetchPriority="high"
            loading="eager"
            draggable={false}
          />
        </div>
        <div ref={peekRef} data-layer="peek" aria-hidden="true" className="hero-layer hero-peek">
          {ROLE_KEYS.map((key) => (
            <Image
              key={key}
              src={ROLE_IMAGE[key]}
              alt=""
              fill
              sizes={SIZES}
              draggable={false}
              data-on={key === peekRole ? "" : undefined}
            />
          ))}
        </div>
      </div>

      <svg
        className="hero-ring"
        viewBox={`0 0 ${WHEEL_VIEWBOX} ${WHEEL_VIEWBOX}`}
        role="radiogroup"
        aria-label={t("wheel.label")}
        onKeyDown={onKeyDown}
      >
        <defs>
          {WHEEL_ORDER.map((key) => {
            const a0 = SECTOR_FROM[key] + GAP;
            const a1 = SECTOR_FROM[key] + 120 - GAP;
            const mid = (a0 + a1) / 2;
            // The bottom label runs right to left along the circle, so it reads left to right on screen.
            const bottom = mid > 90 && mid < 270;
            return <path key={key} id={`${uid}-${key}`} d={bottom ? arcPath(a1, a0, ARC_RADIUS + 16, 0) : arcPath(a0, a1, ARC_RADIUS - 14)} />;
          })}
        </defs>
        {WHEEL_ORDER.map((key) => {
          const d = arcPath(SECTOR_FROM[key] + GAP, SECTOR_FROM[key] + 120 - GAP);
          const checked = key === role;
          const label = t(`roles.${key}.arc`);
          return (
            <g
              key={key}
              ref={(el) => {
                radios.current[key] = el;
              }}
              role="radio"
              aria-checked={checked}
              aria-label={label}
              tabIndex={checked ? 0 : -1}
              className="hero-arc"
              data-on={key === active ? "" : undefined}
              style={{ "--c": ROLE_ACCENT[key] } as CSSProperties}
              onPointerEnter={(e) => e.pointerType !== "touch" && setHover(key)}
              onClick={() => choose(key, true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  choose(key);
                }
              }}
            >
              <path className="hero-arc-hit" d={d} />
              <path className="hero-arc-line" d={d} />
              <text className="hero-arc-label">
                <textPath href={`#${uid}-${key}`} startOffset="50%" textAnchor="middle">
                  {label}
                </textPath>
              </text>
            </g>
          );
        })}
        {!reduced && (
          <g className="hero-orbit" data-orbit="">
            <circle cx={C} cy={6} r={3.5} />
          </g>
        )}
      </svg>
    </div>
  );
}
