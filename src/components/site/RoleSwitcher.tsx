"use client";

import { useTranslations } from "next-intl";
import { useRef, type KeyboardEvent } from "react";
import { ROLE_KEYS, type KoiVariety, type RoleKey } from "@/content/schema";
import { cn } from "@/lib/utils";
import { useRole } from "./RoleProvider";

/** Koi variety behind each role: kohaku (full-stack), showa (tech lead), ogon (PM). */
const KOI_BY_ROLE: Record<RoleKey, KoiVariety> = { fullstack: "kohaku", techlead: "showa", pm: "ogon" };

/** Swatch of each koi: two colours split diagonally, or a single colour for ogon. */
const KOI_DOT: Record<KoiVariety, string> = {
  kohaku: "linear-gradient(135deg, #e4571e 50%, #f4eee7 50%)",
  showa: "linear-gradient(135deg, #111111 50%, #e4571e 50%)",
  ogon: "#e0a84e",
};

const ARROW_STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** Three-way role picker (radiogroup, roving tabindex, arrow keys). The choice lives in the URL via RoleProvider. */
export function RoleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("roles");
  const { role, setRole } = useRole();
  const refs = useRef<Record<RoleKey, HTMLButtonElement | null>>({ fullstack: null, techlead: null, pm: null });

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = ARROW_STEP[e.key];
    if (!step) return;
    e.preventDefault();
    const next = ROLE_KEYS[(ROLE_KEYS.indexOf(role) + step + ROLE_KEYS.length) % ROLE_KEYS.length];
    setRole(next);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex max-w-full flex-wrap gap-0.5 rounded-3xl border sm:gap-1 sm:rounded-full border-border bg-card/60 p-1 backdrop-blur-md",
        className,
      )}
    >
      {ROLE_KEYS.map((key) => {
        const checked = key === role;
        return (
          <button
            key={key}
            ref={(el) => {
              refs.current[key] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => setRole(key)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium whitespace-nowrap sm:gap-2 sm:px-3.5 sm:text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              checked ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span
              aria-hidden
              data-koi={KOI_BY_ROLE[key]}
              className="size-3 shrink-0 rounded-full ring-1 ring-white/40"
              style={{ background: KOI_DOT[KOI_BY_ROLE[key]] }}
            />
            {t(key)}
          </button>
        );
      })}
    </div>
  );
}
