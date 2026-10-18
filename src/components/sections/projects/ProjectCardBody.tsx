import { ChevronRightIcon, ExternalLinkIcon } from "@/components/site/icons";
import { useTranslations } from "next-intl";
import { Marquee } from "@/components/fx/Marquee";
import { cn } from "@/lib/utils";
import { projectKind } from "./project-kind";
import type { ProjectView } from "./ProjectCard";

/** Brand gradients for the placeholder tile, cycled by card position so neighbours differ. */
const TILE_GRADIENTS = [
  "from-brand-500/40 via-brand-400/10 to-teal-400/30",
  "from-teal-400/35 via-teal-400/5 to-brand-500/35",
  "from-brand-400/30 via-card to-teal-500/35",
];

const LINK =
  "relative z-10 inline-flex items-center gap-1 rounded-sm text-sm text-brand-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** Pure project presentation; the client frame delegates the case-study button click. */
export function ProjectCardBody({ project, index, featured = false }: { project: ProjectView; index: number; featured?: boolean }) {
  const t = useTranslations("projects");
  const { videoUrl, posterUrl, caseStudy: cs } = project;
  const kind = projectKind(project.tech);
  const label = `${String(index + 1).padStart(2, "0")}${kind ? ` · ${kind}` : ""}`;
  return <>
      <div
        className={cn(
          "relative aspect-[16/10] overflow-hidden border-b border-border bg-muted/40",
          featured && "md:aspect-auto md:min-h-72 md:border-r md:border-b-0",
        )}
      >
        {videoUrl ? (
          <video
            src={videoUrl}
            poster={posterUrl ?? undefined}
            muted
            playsInline
            loop
            preload="none"
            aria-hidden
            className="absolute inset-0 size-full object-cover"
          />
        ) : posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- poster URLs are admin-supplied and may be any host
          <img
            src={posterUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover/card:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <div
            data-placeholder
            aria-hidden
            className={cn("absolute inset-0 flex items-center justify-center bg-gradient-to-br", TILE_GRADIENTS[index % TILE_GRADIENTS.length])}
          >
            <div
              className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] [background-size:18px_18px]"
            />
            <span className="relative font-heading text-5xl font-semibold tracking-tight text-foreground/80 select-none sm:text-6xl">
              {project.initials}
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <p className="mb-1 text-xs font-medium tracking-[0.2em] text-muted-foreground tabular-nums uppercase">{label}</p>
        <h3 className="font-heading text-xl leading-snug font-semibold">
          {cs ? (
            <button
              type="button"
              aria-haspopup="dialog"
              data-case-study-trigger=""
              className="cursor-pointer text-left outline-none after:absolute after:inset-0 after:z-[1] after:content-['']"
            >
              {project.title}
              <span className="sr-only">, {t("viewCaseStudy")}</span>
            </button>
          ) : (
            project.title
          )}
        </h3>
        <p className="mt-0.5 text-sm font-medium text-brand-text">
          {project.role}
          <span className="font-normal text-muted-foreground"> · {project.period}</span>
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{project.summary}</p>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4">
          {project.demoUrl ? (
            <a href={project.demoUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
              {t("demo")}
              <ExternalLinkIcon aria-hidden className="size-3.5" />
              <span className="sr-only"> {t("newTab")}</span>
            </a>
          ) : null}
          {project.repos.map((repo) => (
            <a key={repo.url} href={repo.url} target="_blank" rel="noopener noreferrer" className={LINK}>
              {repo.label}
              <ExternalLinkIcon aria-hidden className="size-3.5" />
              <span className="sr-only"> {t("newTab")}</span>
            </a>
          ))}
          {cs ? (
            <span aria-hidden className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-brand-text">
              {t("viewCaseStudy")}
              <ChevronRightIcon className="size-4 transition-transform group-data-[active=true]/card:translate-x-0.5" />
            </span>
          ) : null}
        </div>

        {project.tech.length > 0 ? (
          <div
            role="group"
            aria-label={t("techLabel")}
            className="relative z-[2] -mx-4 mt-4 -mb-4 border-t border-border py-2.5 [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)] sm:-mx-5 sm:-mb-5"
          >
            <Marquee speed={28} pauseOnHover className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {project.tech.map((name) => (
                <span key={name} className="text-xs whitespace-nowrap text-foreground/80">
                  {name}
                </span>
              ))}
            </Marquee>
          </div>
        ) : null}
      </div>
  </>;
}
