"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { GlowCard } from "@/components/fx/GlowCard";
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
  /** The case study text itself travels once, in the panel's items; the card only needs to know there is one. */
  hasCaseStudy: boolean;
};

export { projectKind } from "./project-kind";

/** Share of the card that must be on screen before a touch device plays its preview. */
const VISIBLE_RATIO = 0.6;

type ProjectCardProps = {
  children: ReactNode;
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
export function ProjectCard({
  project,
  featured = false,
  wide = false,
  onOpenCaseStudy,
  children,
}: ProjectCardProps) {
  const reduced = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const lit = useIsHighlighted(`proj-${project.id}`);
  const { videoUrl, hasCaseStudy: cs } = project;

  function play() {
    if (reduced) return;
    // play() rejects when interrupted by a quick pause() or blocked by the browser; the poster stays, which is fine.
    cardRef.current
      ?.querySelector("video")
      ?.play()
      ?.catch(() => {});
  }
  function pause() {
    cardRef.current?.querySelector("video")?.pause();
  }

  // Touch devices have no hover: play while at least 60% of the card is on screen.
  useEffect(() => {
    const card = cardRef.current;
    if (
      !videoUrl ||
      !card ||
      reduced ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.intersectionRatio >= VISIBLE_RATIO)
          cardRef.current
            ?.querySelector("video")
            ?.play()
            ?.catch(() => {});
        else cardRef.current?.querySelector("video")?.pause();
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

  return (
    <GlowCard
      ref={cardRef}
      role="article"
      tilt
      maxTiltDeg={4}
      id={`proj-${project.id}`}
      data-highlight={lit ? "true" : undefined}
      data-active={active ? "true" : undefined}
      onClick={(event) => {
        const trigger =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>("[data-case-study-trigger]")
            : null;
        if (trigger && event.currentTarget.contains(trigger))
          onOpenCaseStudy(project.id, trigger);
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className={cn(
        "group/card relative flex min-w-0 scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur-md transition-colors duration-200",
        (featured || wide) && "md:col-span-2",
        featured && "md:grid md:grid-cols-2",
        active && "border-brand-400/60 bg-card/80",
        lit &&
          "border-(--role-accent) bg-card/80 shadow-[0_0_30px_-8px_var(--role-accent)]",
        cs &&
          "has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring",
      )}
    >
      {children}
    </GlowCard>
  );
}
