import { formatTickerValue } from "@/lib/ticker-format";

import { useTranslations } from "next-intl";
import { NumberTicker } from "@/components/fx/NumberTicker";

/** Real numbers from the fact bank: months at SKG, Japanese client projects, projects run in parallel. */
const STATS = [
  { value: 14, label: "monthsAtSkg" },
  { value: 6, label: "jpProjects" },
  { value: 2, label: "parallel" },
] as const;

const CELL = "flex flex-col-reverse justify-end gap-1 rounded-2xl border border-border bg-card/50 px-4 py-3 backdrop-blur-md";
const NUMBER = "font-heading text-3xl font-bold tracking-tight sm:text-4xl";
const LABEL = "text-xs text-muted-foreground sm:text-sm";

/** Row of counted-up numbers plus the static JLPT level. Reduced motion shows the final values. */
export function HeroStats() {
  const t = useTranslations("hero.stats");
  return (
    <dl aria-label={t("label")} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {STATS.map((s) => (
        <div key={s.label} className={CELL}>
          <dt className={LABEL}>{t(s.label)}</dt>
          <dd className={NUMBER}>
            <NumberTicker value={s.value} formattedValue={formatTickerValue(s.value)} />
          </dd>
        </div>
      ))}
      <div className={CELL}>
        <dt className={LABEL}>{t("jlpt")}</dt>
        <dd className={NUMBER}>N3</dd>
      </div>
    </dl>
  );
}
