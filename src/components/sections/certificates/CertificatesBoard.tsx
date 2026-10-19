"use client";

import * as motion from "motion/react-m";
import { useTranslations } from "next-intl";
import {
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";
import { CERT_TOPICS } from "@/content/constants";
import type { CertTopic } from "@/content/schema";
import { clsx } from "clsx";
import { LanternCard, type CertificateView } from "./LanternCard";

type Pane = "certificates" | "activities";
type Filter = "all" | CertTopic;

const PANES: Pane[] = ["certificates", "activities"];
const ARROW_STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/** Moves through `list` from `current` for an arrow/Home/End key; null for any other key. */
function nextIn<T>(list: T[], current: T, key: string): T | null {
  const at = list.indexOf(current);
  if (key === "Home") return list[0];
  if (key === "End") return list[list.length - 1];
  const step = ARROW_STEP[key];
  return step ? list[(at + step + list.length) % list.length] : null;
}

const GRID =
  "grid grid-cols-1 justify-items-center gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3";

/**
 * Certificates and activities. Two tabs; the certificates tab has a topic filter (radiogroup with a count per topic)
 * over the lantern cards. Filtering removes the cards that do not match and the rest glide into place with a motion
 * layout animation (position only, so the lanterns never stretch). Both panels stay mounted so a flipped card keeps
 * its state.
 */
export function CertificatesBoard({
  certificates,
  activities,
  faces,
}: {
  certificates: CertificateView[];
  activities: { id: string; content: ReactNode }[];
  faces: Record<string, { front: ReactNode; back: ReactNode }>;
}) {
  const t = useTranslations("certificates");
  const reduced = usePrefersReducedMotion();
  const uid = useId();
  const [pane, setPane] = useState<Pane>("certificates");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of certificates) map.set(c.topic, (map.get(c.topic) ?? 0) + 1);
    return map;
  }, [certificates]);
  const topics: Filter[] = [
    "all",
    ...CERT_TOPICS.filter((topic) => (counts.get(topic) ?? 0) > 0),
  ];
  // A filter that no longer has any certificate behaves like "all".
  const active: Filter = topics.includes(filter) ? filter : "all";
  const shown =
    active === "all"
      ? certificates
      : certificates.filter((c) => c.topic === active);

  const tabId = (p: Pane) => `${uid}-tab-${p}`;
  const panelId = (p: Pane) => `${uid}-panel-${p}`;
  const filterId = (f: Filter) => `${uid}-filter-${f}`;
  const transition = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 36 };

  function onTabKey(e: KeyboardEvent) {
    const next = nextIn(PANES, pane, e.key);
    if (!next) return;
    e.preventDefault();
    setPane(next);
    document.getElementById(tabId(next))?.focus();
  }

  function onFilterKey(e: KeyboardEvent) {
    const next = nextIn(topics, active, e.key);
    if (!next) return;
    e.preventDefault();
    setFilter(next);
    document.getElementById(filterId(next))?.focus();
  }

  return (
    <div className="mt-10">
      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        onKeyDown={onTabKey}
        className="inline-flex rounded-full border border-border bg-card/60 p-1 backdrop-blur-md"
      >
        {PANES.map((p) => {
          const selected = pane === p;
          return (
            <button
              key={p}
              id={tabId(p)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId(p)}
              tabIndex={selected ? 0 : -1}
              onClick={() => setPane(p)}
              className={clsx(
                "relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                selected
                  ? "text-(--role-accent-contrast)"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {selected ? (
                <motion.span
                  layoutId={`${uid}-tab-pill`}
                  transition={transition}
                  className="absolute inset-0 rounded-full bg-(--role-accent)"
                  aria-hidden="true"
                />
              ) : null}
              <span className="relative">
                {p === "certificates"
                  ? t("tabCertificates")
                  : t("tabActivities")}
              </span>
            </button>
          );
        })}
      </div>

      <div
        id={panelId("certificates")}
        role="tabpanel"
        aria-labelledby={tabId("certificates")}
        hidden={pane !== "certificates"}
        className="mt-8"
      >
        <div
          role="radiogroup"
          aria-label={t("filterLabel")}
          onKeyDown={onFilterKey}
          className="flex flex-wrap gap-2"
        >
          {topics.map((topic) => {
            const checked = active === topic;
            const count =
              topic === "all" ? certificates.length : (counts.get(topic) ?? 0);
            return (
              <button
                key={topic}
                id={filterId(topic)}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                onClick={() => setFilter(topic)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  checked
                    ? "border-(--role-accent) bg-(--role-accent)/15 text-foreground"
                    : "border-border bg-card/40 text-muted-foreground hover:border-(--role-accent)/60 hover:text-foreground",
                )}
              >
                {t(`topics.${topic}`)}
                <span
                  className={clsx(
                    "text-xs tabular-nums",
                    checked
                      ? "text-(--role-accent-text)"
                      : "text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <p role="status" className="sr-only">
          {t("showing", { count: shown.length, total: certificates.length })}
        </p>

        <motion.ul
          layout={!reduced}
          transition={transition}
          className={clsx(GRID, "mt-8")}
        >
          {shown.map((cert, i) => (
            <motion.li
              key={cert.id}
              layout={reduced ? false : "position"}
              transition={transition}
              className="w-full max-w-[19rem] list-none"
            >
              <LanternCard
                cert={cert}
                index={i}
                front={faces[cert.id].front}
                back={faces[cert.id].back}
              />
            </motion.li>
          ))}
        </motion.ul>
      </div>

      <div
        id={panelId("activities")}
        role="tabpanel"
        aria-labelledby={tabId("activities")}
        hidden={pane !== "activities"}
        className="mt-8"
      >
        <ul className={GRID}>
          {activities.map((activity) => (
            <li key={activity.id} className="w-full max-w-[19rem] list-none">
              {activity.content}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
