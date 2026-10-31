"use client";

import { useRef, useState, type ReactNode } from "react";
import type { CaseStudyItem } from "@/components/sections/case-study/CaseStudyPanel";
import { LazyCaseStudyPanel } from "@/components/sections/case-study/LazyCaseStudyPanel";
import { useCaseParam } from "@/components/sections/case-study/use-case-param";
import { ProjectCard, type ProjectView } from "./ProjectCard";

export type { ProjectView };

/**
 * Bento grid of projects: one column on phones, two from md up with the first card across both. A lone last card in
 * the two-column rows also spans both so the grid never ends on a hole. Owns the case study panel, whose previous /
 * next walk `caseItems` (the cards with a case study, in grid order).
 */
export function ProjectsBento({
  projects,
  caseItems,
  bodies,
}: {
  projects: ProjectView[];
  caseItems: CaseStudyItem[];
  bodies: Record<string, ReactNode>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openCase = useCaseParam(caseItems, setOpenId, "bento");
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const loneLast = projects.length > 1 && (projects.length - 1) % 2 === 1;

  function openCaseStudy(id: string, trigger: HTMLElement) {
    returnFocusRef.current = trigger;
    openCase(id);
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {projects.map((project, index) => (
          <ProjectCard
            key={project.id}
            project={project}
            index={index}
            featured={index === 0}
            wide={loneLast && index === projects.length - 1}
            onOpenCaseStudy={openCaseStudy}
          >
            {bodies[project.id]}
          </ProjectCard>
        ))}
      </div>

      <LazyCaseStudyPanel
        items={caseItems}
        openId={openId}
        context="bento"
        onOpenChange={openCase}
        returnFocusRef={returnFocusRef}
      />
    </>
  );
}
