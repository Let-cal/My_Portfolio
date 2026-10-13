import { LanternFrame } from "./LanternFrame";

/** One activity with every string already picked for the current locale. */
export type ActivityView = {
  id: string;
  name: string;
  /** Year only: the source records no more precise date. */
  year: string;
  description: string;
  skills: string[];
};

/** An activity as a lantern that does not flip: year, name, description and the skills it built. */
export function ActivityCard({ activity, index }: { activity: ActivityView; index: number }) {
  return (
    <LanternFrame index={index}>
      <div className="lantern-face lantern-static">
        <p className="text-[11px] font-medium tracking-[0.2em] text-(--role-accent-text) tabular-nums uppercase">{activity.year}</p>
        <h3 className="mt-3 font-heading text-lg leading-snug font-semibold text-balance">{activity.name}</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{activity.description}</p>
        {activity.skills.length > 0 ? (
          <ul className="mt-auto flex flex-wrap gap-1.5 pt-5">
            {activity.skills.map((skill) => (
              <li key={skill} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-foreground/80">
                {skill}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </LanternFrame>
  );
}
