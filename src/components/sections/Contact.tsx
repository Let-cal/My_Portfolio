import { ArrowUpRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { MagneticButton } from "@/components/fx/MagneticButton";
import { AvailabilityStatus } from "@/components/site/AvailabilityStatus";
import { ROLE_KEYS, type Content, type Locale, type RoleKey } from "@/content/schema";
import { pickLocale } from "@/lib/i18n-text";
import { ContactDetails } from "./contact/ContactDetails";
import { ContactHeadline } from "./contact/ContactHeadline";

/**
 * Closing section. A giant headline, a hairline with the 160px round "Get in touch" button sitting on it (a
 * magnetic mailto link, `#contact-core`, which the 3D dragon circles around), then the intro and availability on
 * the left and the contact list on the right. Server component: the role-dependent CV link and the copy button
 * live in the small client part `ContactDetails`.
 */
export function Contact({ content, locale }: { content: Content; locale: Locale }) {
  const t = useTranslations("contact");
  const { profile, roles } = content;

  const cvUrls = Object.fromEntries(ROLE_KEYS.map((key) => [key, roles.find((r) => r.key === key)?.cvFileUrl ?? ""])) as Record<
    RoleKey,
    string
  >;

  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="relative mx-auto max-w-6xl scroll-mt-14 px-4 pt-28 pb-24 sm:px-6 sm:pt-36 sm:pb-32"
    >
      <ContactHeadline
        id="contact-heading"
        text={t("headline")}
        className="font-heading text-[clamp(3rem,10vw,9rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance"
      />

      <div className="relative mt-24">
        <div aria-hidden="true" className="h-px w-full bg-border" />
        <div className="absolute top-0 right-0 -translate-y-1/2 sm:right-6">
          <MagneticButton asChild strength={0.4}>
            <a
              id="contact-core"
              // A solid round button: the veil and the creature's dimming leave it out, so the dragon can circle it in full colour.
              data-scene-ignore=""
              href={`mailto:${profile.email}`}
              className="group/cta grid size-40 place-content-center justify-items-center gap-1 rounded-full bg-[var(--role-accent)] font-heading text-lg font-semibold text-[var(--role-accent-contrast)] outline-none transition-[scale,box-shadow] duration-300 hover:scale-105 hover:shadow-[0_0_60px_-8px_var(--role-accent)] focus-visible:scale-105 focus-visible:ring-4 focus-visible:ring-ring/60 focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-reduce:transition-none"
            >
              {t("cta")}
              <ArrowUpRightIcon
                aria-hidden="true"
                className="size-6 transition-transform duration-300 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5 motion-reduce:transition-none"
              />
            </a>
          </MagneticButton>
        </div>

        <div className="grid gap-10 pt-24 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:gap-16 md:pt-0">
          <div data-scene-avoid="" className="flex flex-col gap-6 md:pt-10">
            <p className="max-w-md text-lg text-pretty text-muted-foreground sm:text-xl">{t("intro")}</p>
            <AvailabilityStatus
              openToWork={profile.openToWork}
              availabilityNote={pickLocale(profile.availabilityNote, locale)}
              location={profile.location}
              labels={{ openToWork: t("openToWork"), localTime: t("localTime") }}
            />
          </div>
          <div data-scene-avoid="" className="md:pt-24">
            <ContactDetails
              email={profile.email}
              linkedin={profile.linkedin}
              github={profile.github}
              bookingUrl={profile.bookingUrl}
              cvUrls={cvUrls}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
