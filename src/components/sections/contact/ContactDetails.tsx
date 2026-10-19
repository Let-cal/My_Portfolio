"use client";

import {
  ArrowUpRightIcon,
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  MailIcon,
} from "@/components/site/icons";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useRole } from "@/components/site/RoleProvider";
import { useCopyEmail } from "@/components/site/use-copy-email";
import type { RoleKey } from "@/content/schema";

export type ContactDetailsProps = {
  email: string;
  linkedin: string;
  github: string;
  /** Rendered only when not null. */
  bookingUrl: string | null;
  cvUrls: Record<RoleKey, string>;
  icons: { github: ReactNode; linkedin: ReactNode };
};

const ROW =
  "group flex min-h-14 items-center gap-3 border-b border-border py-3 text-base outline-none transition-colors hover:text-[var(--role-accent-text)] focus-visible:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-lg";

function Row({
  icon,
  children,
  trailing,
}: {
  icon: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className="text-muted-foreground transition-colors group-hover:text-[var(--role-accent-text)]"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {trailing}
    </>
  );
}

const ARROW = (
  <ArrowUpRightIcon
    aria-hidden="true"
    className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--role-accent-text)] motion-reduce:transition-none"
  />
);

/**
 * The practical ways to reach me: the email (a link plus a Copy button with an inline confirmation and a toast),
 * LinkedIn, GitHub, the CV of the chosen role and, only when the profile has a booking URL, a Book a call link.
 * Never a phone number.
 */
export function ContactDetails({
  email,
  linkedin,
  github,
  bookingUrl,
  cvUrls,
  icons,
}: ContactDetailsProps) {
  const t = useTranslations("contact");
  const { role } = useRole();
  const { copied, copy } = useCopyEmail(email, t("copied"));
  const cvUrl = cvUrls[role];

  return (
    <ul
      aria-label={t("detailsLabel")}
      role="list"
      className="border-t border-border"
    >
      <li className="flex flex-wrap items-stretch gap-x-3 border-b border-border">
        <a
          href={`mailto:${email}`}
          className="group flex min-h-14 min-w-[15rem] flex-1 items-center gap-3 py-3 text-base outline-none transition-colors hover:text-[var(--role-accent-text)] focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-lg"
        >
          <MailIcon
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground group-hover:text-[var(--role-accent-text)]"
          />
          <span className="min-w-0 break-all">{email}</span>
        </a>
        <button
          type="button"
          onClick={copy}
          className="mt-0 mb-3 inline-flex shrink-0 items-center gap-2 self-center sm:my-2 rounded-full border border-border px-4 py-2 text-sm font-medium outline-none transition-colors hover:border-[var(--role-accent)] hover:text-[var(--role-accent-text)] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {copied ? (
            <CheckIcon aria-hidden="true" className="size-4" />
          ) : (
            <CopyIcon aria-hidden="true" className="size-4" />
          )}
          <span aria-live="polite">
            {copied ? t("copied") : t("copyEmail")}
          </span>
        </button>
      </li>
      <li>
        <a
          href={linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className={ROW}
        >
          <Row icon={icons.linkedin} trailing={ARROW}>
            {t("linkedin")}
          </Row>
        </a>
      </li>
      <li>
        <a
          href={github}
          target="_blank"
          rel="noopener noreferrer"
          className={ROW}
        >
          <Row icon={icons.github} trailing={ARROW}>
            {t("github")}
          </Row>
        </a>
      </li>
      {cvUrl && (
        <li>
          <a href={cvUrl} download className={ROW}>
            <Row icon={<DownloadIcon className="size-5" />}>
              {t("downloadCv")}
            </Row>
          </a>
        </li>
      )}
      {bookingUrl && (
        <li>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={ROW}
          >
            <Row icon={<CalendarIcon className="size-5" />} trailing={ARROW}>
              {t("booking")}
            </Row>
          </a>
        </li>
      )}
    </ul>
  );
}
