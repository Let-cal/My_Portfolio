import { KineticText } from "@/components/fx/KineticText";
import { segmentKineticWords } from "@/components/fx/kinetic-words";
import {
  ROLE_KEYS,
  type Content,
  type Locale,
  type RoleKey,
} from "@/content/schema";
import { pickLocale } from "@/lib/i18n-text";
import { getRolePortraits } from "@/lib/role-portraits.server";
import { HeroStats } from "./hero/HeroStats";
import { NameMarquee } from "./hero/NameMarquee";
import { ProfileStatusCard } from "./hero/ProfileStatusCard";
import { QuickFacts } from "./hero/QuickFacts";
import { RoleStage } from "./hero/RoleStage";
import { RotatingPhrase } from "./hero/RotatingPhrase";
import { HeroRoleBody, HeroRoleTitle, type HeroRoleData } from "./HeroRole";

/**
 * First section, built around the role wheel. Top: the name (h1, per-letter entrance, still the HTML text) and
 * the scrambled title of the chosen role. Middle: the wheel with its three annotated role panels, over a glow in the
 * role accent and the empty water zone the 3D koi swim in. Then the rotating intro line, summary and CTAs, the status
 * card, the numbers, the trilingual name ticker and the quick facts. Role-dependent parts are small client components
 * that only receive the three roles' display data.
 */
export function Hero({
  content,
  locale,
}: {
  content: Content;
  locale: Locale;
}) {
  const { profile, roles, education } = content;

  const roleData = Object.fromEntries(
    ROLE_KEYS.map((key) => {
      const role = roles.find((r) => r.key === key);
      return [
        key,
        {
          title: pickLocale(role?.title, locale),
          summary: pickLocale(profile.summaries[key], locale),
          cvFileUrl: role?.cvFileUrl ?? "",
        },
      ];
    }),
  ) as Record<RoleKey, HeroRoleData>;
  const cvUrls = Object.fromEntries(
    ROLE_KEYS.map((key) => [key, roleData[key].cvFileUrl]),
  ) as Record<RoleKey, string>;
  const availabilityNote = pickLocale(profile.availabilityNote, locale);
  const school = [...education].sort((a, b) => a.sortIndex - b.sortIndex)[0];

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative mx-auto w-full max-w-6xl scroll-mt-14 px-4 pt-10 pb-16 sm:px-6 sm:pt-14 lg:pt-16"
    >
      <header data-scene-avoid="" className="relative z-[3] text-center">
        <h1
          id="hero-heading"
          className="font-heading text-[clamp(2.4rem,6vw,4.25rem)] leading-[1.02] font-extrabold tracking-[-0.025em] text-balance"
        >
          <KineticText
            text={profile.name}
            preparedWords={segmentKineticWords(profile.name)}
          />
        </h1>
        <HeroRoleTitle roles={roleData} />
      </header>

      <div className="hero-stage-wrap mt-4 sm:mt-6">
        <RoleStage portraits={getRolePortraits()} />
      </div>

      <div data-scene-avoid="" className="mx-auto mt-14 max-w-3xl text-center">
        <RotatingPhrase className="font-heading text-xl font-medium text-balance sm:text-2xl" />
        <HeroRoleBody roles={roleData} locale={locale} />
      </div>

      <div data-scene-avoid="" className="mt-14 flex flex-col gap-4">
        <ProfileStatusCard
          openToWork={profile.openToWork}
          availabilityNote={availabilityNote}
          location={profile.location}
          email={profile.email}
          cvUrls={cvUrls}
        />
        <HeroStats />
      </div>

      <div data-scene-ignore="" className="-mx-4 mt-14 sm:-mx-6">
        <NameMarquee name={profile.name} />
      </div>

      <div data-scene-avoid="" className="mt-10">
        <QuickFacts
          education={{
            school: school?.school ?? "",
            major: pickLocale(school?.major, locale),
            gpa: school?.gpa,
          }}
          openToWork={profile.openToWork}
          availabilityNote={availabilityNote}
        />
      </div>
    </section>
  );
}
