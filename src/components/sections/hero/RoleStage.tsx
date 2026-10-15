"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { RoleKey } from "@/content/schema";
import type { RolePortraits } from "@/lib/role-portraits";
import { ROLE_ACCENT, SECTOR_FROM, WHEEL_ORDER } from "@/lib/role-accent";
import { PANEL_SIDE, RolePanels } from "./RolePanels";
import { ARC_RADIUS, RoleWheel, WHEEL_VIEWBOX, wheelPoint } from "./RoleWheel";
import { RoleStageProvider, useStage } from "./stage-context";

type Line = { d: string; length: number; start: [number, number]; end: [number, number] };
type Geometry = { width: number; height: number; lines: Record<RoleKey, Line> };

/** Leader line from the middle of a role's arc to the edge of its panel: one horizontal elbow left/right, straight down for the bottom panel. */
function measure(stage: HTMLElement): Geometry | null {
  const box = stage.getBoundingClientRect();
  const wheel = stage.querySelector<HTMLElement>("[data-role-wheel]")?.getBoundingClientRect();
  if (!wheel || wheel.width === 0) return null;
  const scale = wheel.width / WHEEL_VIEWBOX;
  const lines = {} as Record<RoleKey, Line>;
  for (const key of WHEEL_ORDER) {
    const panel = stage.querySelector<HTMLElement>(`[data-panel='${key}']`)?.getBoundingClientRect();
    if (!panel) return null;
    const [ax, ay] = wheelPoint(SECTOR_FROM[key] + 60, ARC_RADIUS + 4);
    const x0 = wheel.left - box.left + ax * scale;
    const y0 = wheel.top - box.top + ay * scale;
    const side = PANEL_SIDE[key];
    let x1: number;
    let y1: number;
    if (side === "left") [x1, y1] = [panel.right - box.left + 14, panel.top - box.top + 18];
    else if (side === "right") [x1, y1] = [panel.left - box.left - 14, panel.top - box.top + 18];
    else [x1, y1] = [panel.left - box.left + panel.width / 2, panel.top - box.top - 12];
    let d: string;
    let length: number;
    if (side === "bottom") {
      d = `M${x0} ${y0} L${x1} ${y1}`;
      length = Math.hypot(x1 - x0, y1 - y0);
    } else {
      const elbowX = (x0 + x1) / 2;
      d = `M${x0} ${y0} L${elbowX} ${y1} L${x1} ${y1}`;
      length = Math.hypot(elbowX - x0, y1 - y0) + Math.abs(x1 - elbowX);
    }
    lines[key] = { d, length: Math.ceil(length) + 2, start: [x0, y0], end: [x1, y1] };
  }
  return { width: box.width, height: box.height, lines };
}

/**
 * Hero centrepiece: the role wheel with its three annotated panels (left, right, below) and the leader lines that
 * connect the lit arc to its panel. Below the wide layout the panels stack under the wheel as an accordion and the
 * lines are hidden (CSS). The empty `data-water-zone` behind the wheel is where the 3D koi swim.
 */
export function RoleStage({ portraits }: { portraits?: RolePortraits }) {
  return (
    <RoleStageProvider>
      <StageView portraits={portraits} />
    </RoleStageProvider>
  );
}

function StageView({ portraits }: { portraits?: RolePortraits }) {
  const t = useTranslations("hero.wheel");
  const { active, reduced } = useStage();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const panels = [...stage.querySelectorAll("[data-panel]")];
    let wide = false;
    let disposed = false;
    const observer = new ResizeObserver((entries) => {
      if (disposed) return;
      // The stage fills .hero-stage-wrap's content box, with no inline padding/border.
      // Match its 52rem container query using delivered sizes, never mobile rect reads.
      const stageEntry = entries.find((entry) => entry.target === stage);
      if (stageEntry) {
        const sizes = stageEntry.borderBoxSize as ResizeObserverSize | readonly ResizeObserverSize[] | undefined;
        const width = (sizes && ("inlineSize" in sizes ? sizes.inlineSize : sizes[0]?.inlineSize)) ?? stageEntry.contentRect.width;
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const nextWide = width >= 52 * rem;
        if (wide !== nextWide) {
          wide = nextWide;
          panels.forEach((panel) => wide ? observer.observe(panel) : observer.unobserve(panel));
          if (!wide) setGeometry(null);
        }
      }
      if (wide) setGeometry(measure(stage));
    });
    observer.observe(stage);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={stageRef} className="hero-stage">
      <div data-water-zone="" aria-hidden="true" className="hero-water" />
      {geometry && (
        <svg
          aria-hidden="true"
          className="hero-lines"
          width={geometry.width}
          height={geometry.height}
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        >
          {WHEEL_ORDER.map((key) => {
            const line = geometry.lines[key];
            const on = key === active;
            const color = ROLE_ACCENT[key];
            return (
              <g key={key} data-on={on ? "" : undefined}>
                <path
                  d={line.d}
                  stroke={color}
                  strokeDasharray={line.length}
                  strokeDashoffset={on ? 0 : line.length}
                  className="hero-line"
                />
                <circle cx={line.start[0]} cy={line.start[1]} r={4.5} fill={color} className="hero-line-dot">
                  {on && !reduced && (
                    <>
                      <animate attributeName="r" values="4.5;9;4.5" dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="1;.25;1" dur="1.6s" repeatCount="indefinite" />
                    </>
                  )}
                </circle>
                <circle cx={line.end[0]} cy={line.end[1]} r={3} fill={color} className="hero-line-dot" />
              </g>
            );
          })}
        </svg>
      )}
      <RoleWheel portraits={portraits} />
      <RolePanels />
      <p className="hero-hint">
        <span className="hero-hint-fine">{t("hint")}</span>
        <span className="hero-hint-touch">{t("touchHint")}</span>
      </p>
    </div>
  );
}
