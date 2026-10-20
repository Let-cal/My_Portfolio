import { useTranslations } from "next-intl";
import { Marquee } from "@/components/fx/Marquee";

/**
 * Outlined name ticker in three languages at the foot of the hero ("Le Tran Cat Lam — レ・チャン・カット・ラム —
 * Lê Trần Cát Lâm —"). Decorative (the name is the h1), so it is hidden from assistive tech.
 */
export function NameMarquee({ name }: { name: string }) {
  const t = useTranslations("hero");
  const names = [name, t("nameJa"), t("nameVi")];
  return (
    <div aria-hidden="true" className="select-none">
      <Marquee speed={36} decorative>
        {names.map((n) => (
          <span
            key={n}
            className="hero-stroke-text font-heading text-5xl leading-tight font-bold whitespace-nowrap sm:text-7xl"
          >
            {n} —
          </span>
        ))}
      </Marquee>
    </div>
  );
}
