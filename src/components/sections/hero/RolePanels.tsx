"use client";

import { useTranslations } from "next-intl";
import { useId, type CSSProperties } from "react";
import type { RoleKey } from "@/content/schema";
import { ROLE_ACCENT, WHEEL_ORDER } from "@/lib/role-accent";
import { RoleStageProvider, useOptionalStage, useStage } from "./stage-context";

/** Where each panel sits around the wheel on wide screens. */
export const PANEL_SIDE: Record<RoleKey, "left" | "right" | "bottom"> = { fullstack: "left", techlead: "right", pm: "bottom" };

/**
 * The three annotated role panels (prototype variant A). Collapsed: number, role and a big title with one serif
 * accent word. The lit panel (hovered, or the chosen role) opens a short description and four skill chips.
 * Each panel heading is a pressed-state button that chooses its role.
 */
export function RolePanels() {
  return useOptionalStage() ? (
    <PanelsView />
  ) : (
    <RoleStageProvider>
      <PanelsView />
    </RoleStageProvider>
  );
}

function PanelsView() {
  return (
    <div className="hero-panels">
      {WHEEL_ORDER.map((key, i) => (
        <Panel key={key} roleKey={key} index={i} />
      ))}
    </div>
  );
}

function Panel({ roleKey, index }: { roleKey: RoleKey; index: number }) {
  const t = useTranslations(`hero.roles.${roleKey}`);
  const { role, active, setHover, select } = useStage();
  const detailsId = useId();
  const open = active === roleKey;
  const chips = t.raw("chips") as string[];

  return (
    <div
      data-panel={roleKey}
      data-scene-avoid=""
      data-side={PANEL_SIDE[roleKey]}
      data-state={open ? "active" : "collapsed"}
      className="hero-panel"
      style={{ "--c": ROLE_ACCENT[roleKey] } as CSSProperties}
      onPointerEnter={(e) => e.pointerType !== "touch" && setHover(roleKey)}
      onPointerLeave={(e) => e.pointerType !== "touch" && setHover(null)}
      onClick={() => select(roleKey)}
    >
      <h3 className="m-0">
        <button type="button" aria-pressed={role === roleKey} aria-controls={detailsId} className="hero-panel-button">
          <span className="hero-panel-tag">
            <i aria-hidden="true" />
            {String(index + 1).padStart(2, "0")} · {t("eyebrow")}
          </span>
          <span className="hero-panel-title">{t.rich("title", { accent: () => <em>{t("accent")}</em> })}</span>
        </button>
      </h3>
      <div id={detailsId} data-panel-details="" aria-hidden={!open} className="hero-panel-more">
        <div>
          <p className="hero-panel-body">{t("body")}</p>
          <ul className="hero-chips">
            {chips.map((chip, i) => (
              <li key={chip} className="hero-chip" style={{ "--i": i } as CSSProperties}>
                {chip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
