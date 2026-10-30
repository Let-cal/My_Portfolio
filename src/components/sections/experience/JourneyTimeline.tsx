import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import type { JourneyParent } from "@/lib/journey";

const pct = (n: number) => `${n * 100}%`;

/**
 * The mini Gantt of a company (spec 5.1 A2, 5.2 B8): the month axis, the stint lane (koi gradient, the internship
 * lighter, a ↑ tick where a promotion starts) and one 10 px bar per project on the same axis.
 *
 * It is one `role="img"` labelled with a sentence listing the positions and project spans; the project rows below are the accessible source, so nothing in
 * here is focusable. Each bar carries `data-bar` and `data-sync=<project id>`: the tree's single delegated
 * listener lights a bar and its row together and scrolls to the row when a bar is clicked. It fills the tree's
 * `.jt-slot`, whose height is fixed by the number of lanes, so loading it after first paint never shifts the page.
 */
export function JourneyTimeline({ parent }: { parent: JourneyParent }) {
  const t = useTranslations("experience");
  const { months, axis, segments, bars } = parent.timeline!;
  const byId = new Map(parent.stints.map((s) => [s.id, s]));
  const label = t("timelineLabel", {
    company: parent.name,
    positions: parent.stints
      .filter((s) => s.id !== "")
      .map((s) => `${s.shortLabel} (${s.period})`)
      .join(", "),
    projects: parent.children.map((c) => `${c.title} (${c.period})`).join(", "),
  });
  return (
    <div
      role="img"
      aria-label={label}
      className="jt-gantt"
      style={{ "--months": months } as CSSProperties}
    >
      <div className="jt-axis">
        {axis.map((tick) => (
          <span key={tick.index} style={{ left: pct(tick.index / months) }}>
            {tick.label}
          </span>
        ))}
      </div>
      <div className="jt-lane">
        {/* By start, so a newer position (sharing its first month with the older one's last) is drawn on top. */}
        {[...segments]
          .sort((a, b) => a.from - b.from)
          .map((s, i) => (
            <span
              key={s.id}
              className="jt-seg"
              data-intern={
                byId.get(s.id)?.employmentType === "internship" ? "" : undefined
              }
              style={
                {
                  left: pct(s.from),
                  width: pct(s.to - s.from),
                  "--i": i,
                } as CSSProperties
              }
            >
              {s.label}
            </span>
          ))}
        {segments.map((s) =>
          byId.get(s.id)?.promotedFrom ? (
            <span
              key={`tick:${s.id}`}
              className="jt-tick"
              style={{ left: pct(s.from) }}
            >
              ↑
            </span>
          ) : null,
        )}
      </div>
      {bars.map((bar, i) => {
        // The name goes after the bar when there is more room there, otherwise before it, right-aligned.
        const after = 1 - bar.to >= bar.from;
        return (
          <div key={bar.id} className="jt-lane">
            <span
              data-bar=""
              data-sync={bar.id}
              className="jt-bar"
              style={
                {
                  left: pct(bar.from),
                  width: pct(bar.to - bar.from),
                  "--i": i + 1,
                } as CSSProperties
              }
            />
            <span
              className="jt-blabel"
              style={
                after
                  ? { left: `calc(${pct(bar.to)} + 8px)` }
                  : { right: `calc(${pct(1 - bar.from)} + 8px)` }
              }
            >
              {bar.title}
            </span>
          </div>
        );
      })}
    </div>
  );
}
