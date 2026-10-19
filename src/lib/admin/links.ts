/** Evidence target of a skill link: exactly one experience or one project. */
export type LinkTarget = { experienceId: string } | { projectId: string };

/** What to insert and delete to turn the `current` set of ids into `next`. */
export function diffLinks(current: string[], next: string[]): { add: string[]; remove: string[] } {
  const now = new Set(current);
  const want = new Set(next);
  return {
    add: [...want].filter((id) => !now.has(id)),
    remove: [...now].filter((id) => !want.has(id)),
  };
}

export function linkRow(skillId: string, target: LinkTarget) {
  return {
    skill_id: skillId,
    experience_id: "experienceId" in target ? target.experienceId : null,
    project_id: "projectId" in target ? target.projectId : null,
  };
}

/** The columns that identify one link, for `delete().match(...)`. */
export function linkMatch(skillId: string, target: LinkTarget) {
  return "experienceId" in target
    ? { skill_id: skillId, experience_id: target.experienceId }
    : { skill_id: skillId, project_id: target.projectId };
}
