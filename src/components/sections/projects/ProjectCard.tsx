"use client";

import { ChevronRightIcon, ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { CaseStudyView } from "@/components/sections/experience/CaseStudySheet";
import { GlowCard } from "@/components/fx/GlowCard";
import { Marquee } from "@/components/fx/Marquee";
import { usePrefersReducedMotion } from "@/components/fx/use-media-query";
import { useIsHighlighted } from "@/components/site/HighlightProvider";
import { cn } from "@/lib/utils";

/** One project with every string already picked for the current locale. */
export type ProjectView = {
  id: string;
  title: string;
  /** Letters shown on the placeholder tile when there is no poster or video. */
  initials: string;
  role: string;
  period: string;
  summary: string;
  tech: string[];
  demoUrl: string | null;
  /** Repository links with their final label, e.g. "Code (Web)". */
  repos: { url: string; label: string }[];
  posterUrl: string | null;
  videoUrl: string | null;
  caseStudy: CaseStudyView | null;
};

const MOBILE_TECH = /^(flutter|dart)$/i;
const WEB_TECH = /^(react|next\.js|java servlet)$/i;

/** "WEB", "MOBILE" or "WEB + MOBILE" from the tech list; null when nothing in it says which. */
export function projectKind(tech: string[]): "WEB" | "MOBILE" | "WEB + MOBILE" | null {
  const mobile = tech.some((name) => MOBILE_TECH.test(name));
  const web = tech.some((name) => WEB_TECH.test(name));
  return web && mobile ? "WEB + MOBILE" : mobile ? "MOBILE" : web ? "WEB" : null;
}

/** Share of the card that must be on screen before a touch device plays its preview. */
const VISIBLE_RATIO = 0.6;

/** Brand gradients for the placeholder tile, cycled by card position so neighbours differ. */
const TILE_GRADIENTS = [
  "from-brand-500/40 via-brand-400/10 to-teal-400/30",
  "from-teal-400/35 via-teal-400/5 to-brand-500/35",
  "from-brand-400/30 via-card to-teal-500/35",
];

const LINK =
  "relative z-10 inline-flex items-center gap-1 rounded-sm text-sm text-brand-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

type ProjectCardProps = {
  project: ProjectView;
  /** Position in the grid; picks the placeholder gradient. */
  index: number;
  /** Spans both columns on desktop and lays media beside the text. */
  featured?: boolean;
  /** Spans both columns on desktop without being the featured card (a lone last card). */
  wide?: boolean;
  onOpenCaseStudy: (id: string, trigger: HTMLElement) => void;
};

/**
 * One bento tile: media on top (hover/in-view video preview, poster, or a brand-colour placeholder with the project
 * initials), then an "NN · KIND" label, title, role, summary, Demo/Code links and a tech-name marquee along the bottom. With a case study the whole card opens it.
 */
export function ProjectCard({ project, index, featured = false, wide = false, onOpenCaseStudy }: ProjectCardProps) {
  const t = useTranslations("projects");
  const reduced = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const lit = useIsHighlighted(`proj-${project.id}`);
  const { videoUrl, posterUrl, caseStudy: cs } = project;

  function play() {
    if (reduced) return;
    // play() rejects when interrupted by a quick pause() or blocked by the browser; the poster stays, which is fine.
    videoRef.current?.play()?.catch(() => {});
  }
  function pause() {
    videoRef.current?.pause();
  }

  // Touch devices have no hover: play while at least 60% of the card is on screen.
  useEffect(() => {
    const card = cardRef.current;
    if (!videoUrl || !card || reduced || typeof IntersectionObserver === "undefined") return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.intersectionRatio >= VISIBLE_RATIO) videoRef.current?.play()?.catch(() => {});
        else videoRef.current?.pause();
      },
      { threshold: VISIBLE_RATIO },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [videoUrl, reduced]);

  function onPointerEnter(e: PointerEvent) {
    setActive(true);
    if (e.pointerType !== "touch") play();
  }
  function onPointerLeave(e: PointerEvent) {
    setActive(false);
    if (e.pointerType !== "touch") pause();
  }

  const kind = projectKind(project.tech);
  const label = `${String(index + 1).padStart(2, "0")}${kind ? ` · ${kind}` : ""}`;

  return (
    <GlowCard
      ref={cardRef}
      role="article"
      tilt
      maxTiltDeg={4}
      id={`proj-${project.id}`}
      data-highlight={lit ? "true" : undefined}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className={cn(
        "group/card relative flex min-w-0 scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur-md transition-colors duration-200",
        (featured || wide) && "md:col-span-2",
        featured && "md:grid md:grid-cols-2",
        active && "border-brand-400/60 bg-card/80",
        lit && "border-(--role-accent) bg-card/80 shadow-[0_0_30px_-8px_var(--role-accent)]",
        cs && "has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring",
      )}
    >
      <div
        className={cn(
          "relative aspect-[16/10] overflow-hidden border-b border-border bg-muted/40",
          featured && "md:aspect-auto md:min-h-72 md:border-r md:border-b-0",
        )}
      >
        {videoUrl ? (
          <video
            ref={videoRef}
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
              onClick={(e) => onOpenCaseStudy(project.id, e.currentTarget)}
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
              <ChevronRightIcon className={cn("size-4 transition-transform", active && "translate-x-0.5")} />
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
    </GlowCard>
  );
}
