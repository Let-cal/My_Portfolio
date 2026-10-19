"use client";

import { useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { ProjectCard, type ProjectView } from "./ProjectCard";

const CaseStudySheet = dynamic(
  () =>
    import("@/components/sections/experience/CaseStudySheet").then(
      (module) => module.CaseStudySheet,
    ),
  { ssr: false },
);

export type { ProjectView };

/**
 * Bento grid of projects: one column on phones, two from md up with the first card across both. A lone last card in
 * the two-column rows also spans both so the grid never ends on a hole. Owns the case study sheet.
 */
export function ProjectsBento({
  projects,
  bodies,
}: {
  projects: ProjectView[];
  bodies: Record<string, ReactNode>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [shownId, setShownId] = useState<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const shown = projects.find((p) => p.id === shownId);
  const loneLast = projects.length > 1 && (projects.length - 1) % 2 === 1;

  function openCaseStudy(id: string, trigger: HTMLElement) {
    returnFocusRef.current = trigger;
    setShownId(id);
    setOpenId(id);
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

      {shown?.caseStudy ? (
        <CaseStudySheet
          open={openId !== null}
          onOpenChange={(next) => {
            if (!next) setOpenId(null);
          }}
          title={shown.title}
          description={[shown.role, shown.period].join(" · ")}
          caseStudy={shown.caseStudy}
          tech={shown.tech}
          returnFocusRef={returnFocusRef}
        />
      ) : null}
    </>
  );
}
