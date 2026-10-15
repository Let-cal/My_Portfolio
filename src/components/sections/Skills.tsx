import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Marquee } from "@/components/fx/Marquee";
import { ROLE_KEYS, SKILL_GROUPS, type Content, type Locale, type RoleKey, type SkillGroup } from "@/content/schema";
import { formatPeriod } from "@/lib/format";
import { pickLocale } from "@/lib/i18n-text";
import { orderSkillGroups } from "@/lib/roles";
import { evidenceFor } from "@/lib/skills";
import { SkillGlyph, SkillMonogram } from "./skills/SkillGlyph";
import { monogramOf, skillIconFor } from "./skills/skill-icons";
import { SkillMap, type EvidenceView, type SkillMapData, type SkillView } from "./skills/SkillMap";
import { Reveal } from "@/components/site/Reveal";

/**
 * Skills section ("waterfall"): two opposite marquees of skill names, then the skill map. Server component: it
 * resolves every skill's evidence into localized mini-card data and hands it to the client SkillMap, together with the
 * group order of each role. Brand glyphs are defined once in an SVG sprite here, so no icon data ships in client JS.
 */
export function Skills({ content, locale }: { content: Content; locale: Locale }) {
  const t = useTranslations("skills");
  const ts = useTranslations("sections");
  const { profile, roles, skills } = content;

  const groupsOf = (key: RoleKey): SkillGroup[] => {
    const role = roles.find((r) => r.key === key);
    const order = role ? orderSkillGroups(role) : [...SKILL_GROUPS];
    return order.filter((g) => skills.some((s) => s.group === g));
  };
  const orders = Object.fromEntries(ROLE_KEYS.map((key) => [key, groupsOf(key)])) as Record<RoleKey, SkillGroup[]>;
  const titles = Object.fromEntries(
    ROLE_KEYS.map((key) => [key, pickLocale(roles.find((r) => r.key === key)?.title, locale)]),
  ) as Record<RoleKey, string>;

  const views: SkillView[] = SKILL_GROUPS.flatMap((group) =>
    skills
      .filter((s) => s.group === group)
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map((s): SkillView => {
        const icon = skillIconFor(s.id);
        const { experiences, projects } = evidenceFor(s.id, content);
        const evidence: EvidenceView[] = [
          ...experiences.map(
            (e): EvidenceView => ({
              kind: "exp",
              id: e.id,
              anchor: `exp-${e.id}`,
              title: e.company,
              role: pickLocale(e.position, locale),
              period: formatPeriod(e.start, e.end, locale),
            }),
          ),
          ...projects.map(
            (p): EvidenceView => ({
              kind: "proj",
              id: p.id,
              anchor: `proj-${p.id}`,
              title: p.title,
              role: pickLocale(p.role, locale),
              period: formatPeriod(p.start, p.end, locale),
            }),
          ),
        ];
        return {
          id: s.id,
          name: s.name,
          group: s.group,
          monogram: monogramOf(s.name),
          icon: icon && { hex: icon.hex, hexDark: icon.hexDark },
          evidence,
        };
      }),
  );

  const data: SkillMapData = { name: profile.name, titles, orders, skills: views };

  // Marquee rows follow the default role's group order; the first half runs one way, the second half the other.
  const rank = new Map(orders.fullstack.map((g, i) => [g, i]));
  const flat = [...views].sort((a, b) => (rank.get(a.group) ?? 99) - (rank.get(b.group) ?? 99));
  const half = Math.ceil(flat.length / 2);
  const rows = [flat.slice(0, half), flat.slice(half)];

  return (
    <section
      id="skills"
      aria-labelledby="skills-heading"
      className="relative mx-auto max-w-6xl scroll-mt-14 px-4 py-24 sm:px-6"
    >
      <Reveal>
        <h2 id="skills-heading" data-scene-avoid="" className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {ts("skills")}
        </h2>
        <p data-scene-avoid="" className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">{t("intro")}</p>
      </Reveal>

      {/* The same names as the map below, as decoration: hidden from assistive tech and from the tab order. */}
      <div
        aria-hidden="true"
        className="-mx-4 mt-10 flex flex-col gap-3 [mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)] sm:-mx-6"
      >
        {rows.map((row, i) => (
          <Marquee key={i} speed={i === 0 ? 34 : 26} reverse={i === 1} pauseOnHover decorative className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {row.map((skill) => (
              <span
                key={skill.id}
                className="skill-mq inline-flex items-center gap-2.5 font-heading text-xl font-semibold whitespace-nowrap text-muted-foreground sm:text-3xl"
                style={{ "--sk-hex": skill.icon?.hex, "--sk-hex-dark": skill.icon?.hexDark } as CSSProperties}
              >
                {skill.icon ? <SkillGlyph skillId={skill.id} className="size-5 sm:size-7" /> : <SkillMonogram letters={skill.monogram} className="size-5 text-[9px] sm:size-7 sm:text-xs" />}
                {skill.name}
              </span>
            ))}
          </Marquee>
        ))}
      </div>

      <SkillMap data={data} />
    </section>
  );
}
