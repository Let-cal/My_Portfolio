import type { Content, Experience, Project, Skill, SkillGroup } from "@/content/schema";

/** Published experiences and projects that used a skill, in sortIndex order. Unknown skill or dangling ids give nothing. */
export function evidenceFor(skillId: string, content: Content): { experiences: Experience[]; projects: Project[] } {
  const skill = content.skills.find((s) => s.id === skillId);
  if (!skill) return { experiences: [], projects: [] };
  const expIds = new Set(skill.experienceIds);
  const projIds = new Set(skill.projectIds);
  const bySort = <T extends { sortIndex: number }>(a: T, b: T) => a.sortIndex - b.sortIndex;
  return {
    experiences: content.experiences.filter((e) => e.published && expIds.has(e.id)).sort(bySort),
    projects: content.projects.filter((p) => p.published && projIds.has(p.id)).sort(bySort),
  };
}

/** The skills of one group, in sortIndex order. */
export function skillsInGroup(group: SkillGroup, content: Content): Skill[] {
  return content.skills.filter((s) => s.group === group).sort((a, b) => a.sortIndex - b.sortIndex);
}
