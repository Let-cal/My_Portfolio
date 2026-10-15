import { ExternalLinkIcon, RotateCwIcon } from "@/components/site/icons";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { CertificateView } from "./LanternCard";

const LINK =
  "pointer-events-auto relative inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-(--role-accent-text) underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** Static certificate artwork and content, rendered on the server. */
export function LanternFront({cert, topicLabel}: {cert: CertificateView; topicLabel: string}) {
 const t=useTranslations("certificates");
 return (<div aria-hidden="true" className="lantern-face lantern-front">
            <p className="text-[11px] font-medium tracking-[0.2em] text-(--role-accent-text) uppercase">{topicLabel}</p>
            <h3 className="mt-3 font-heading text-lg leading-snug font-semibold text-balance">{cert.name}</h3>
            <div className="mt-auto pt-5">
              <p className="text-sm text-foreground/90">{cert.organization}</p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{cert.issued}</p>
              <p className="mt-4 flex items-center gap-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
                <RotateCwIcon className="size-3" />
                {t("showDetails")}
              </p>
            </div>
          </div>);
}

export function LanternBack({cert}: {cert: CertificateView}) {
 const t=useTranslations("certificates");
 const tp=useTranslations("projects");
 return (<><p className="text-[11px] font-medium tracking-[0.2em] text-(--role-accent-text) uppercase">{t("credentialId")}</p>
            <p className="mt-1.5 font-mono text-sm break-all text-foreground">{cert.credentialId ?? "—"}</p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              {cert.credentialUrl ? (
                <a data-verify="" href={cert.credentialUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                  {t("verify")}
                  <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
                  <span className="sr-only"> {tp("newTab")}</span>
                </a>
              ) : null}
              {cert.fileUrl ? (
                <a href={cert.fileUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                  {t("viewFile")}
                  <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
                  <span className="sr-only"> {tp("newTab")}</span>
                </a>
              ) : null}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{cert.description}</p>

            <p
              aria-hidden="true"
              className={cn("mt-auto flex items-center gap-1.5 pt-4 text-[11px] tracking-wide text-muted-foreground uppercase")}
            >
              <RotateCwIcon className="size-3 -scale-x-100" />
              {t("showFront")}
            </p></>);
}
