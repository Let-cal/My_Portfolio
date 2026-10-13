import { useTranslations } from "next-intl";
import type { Content, Locale } from "@/content/schema";
import { formatMonth } from "@/lib/format";
import { pickLocale } from "@/lib/i18n-text";
import type { ActivityView } from "./certificates/ActivityCard";
import { CertificatesBoard } from "./certificates/CertificatesBoard";
import type { CertificateView } from "./certificates/LanternCard";

/**
 * Certificates section ("lanterns"). Builds localized view-models (published certificates and all activities, in
 * sortIndex order) and hands them to the client board, which owns the tabs, the topic filter and the card flips.
 */
export function Certificates({ content, locale }: { content: Content; locale: Locale }) {
  const t = useTranslations("certificates");
  const ts = useTranslations("sections");

  const certificates = content.certificates
    .filter((c) => c.published)
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map(
      (c): CertificateView => ({
        id: c.id,
        name: c.name,
        organization: c.organization,
        issued: formatMonth(c.issueDate.slice(0, 7), locale),
        credentialId: c.credentialId,
        credentialUrl: c.credentialUrl,
        fileUrl: c.fileUrl,
        topic: c.topic,
        description: pickLocale(c.description, locale),
      }),
    );

  const activities = [...content.activities]
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map(
      (a): ActivityView => ({
        id: a.id,
        name: pickLocale(a.name, locale),
        year: a.date.slice(0, 4),
        description: pickLocale(a.description, locale),
        skills: a.skills,
      }),
    );

  return (
    <section
      id="certificates"
      aria-labelledby="certificates-heading"
      className="relative mx-auto max-w-6xl scroll-mt-14 px-4 py-24 sm:px-6"
    >
      <h2 id="certificates-heading" className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
        {ts("certificates")}
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">{t("intro")}</p>
      <CertificatesBoard certificates={certificates} activities={activities} />
    </section>
  );
}
