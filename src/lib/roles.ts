import { ROLE_KEYS, SKILL_GROUPS } from "@/content/constants";
import type { Experience, Role, RoleKey, SkillGroup } from "@/content/schema";

export const DEFAULT_ROLE: RoleKey = "fullstack";

/** Reads a `?role=` value; anything unknown becomes the default role. */
export function parseRole(v: string | null | undefined): RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(v ?? "")
    ? (v as RoleKey)
    : DEFAULT_ROLE;
}

/**
 * Published stints (the `experiences` rows; projects live in `projects`): ids listed in `role.experienceOrder`
 * first (in that order), the rest by `sortIndex`. The order lists stint ids, never project ids.
 */
export function orderExperiences(exps: Experience[], role: Role): Experience[] {
  const published = exps.filter((e) => e.published);
  const byId = new Map(published.map((e) => [e.id, e]));
  const ordered: Experience[] = [];
  for (const id of role.experienceOrder) {
    const e = byId.get(id);
    if (e) {
      ordered.push(e);
      byId.delete(id);
    }
  }
  const rest = [...byId.values()].sort((a, b) => a.sortIndex - b.sortIndex);
  return [...ordered, ...rest];
}

/** `role.skillGroupOrder` first, then the remaining groups in declaration order. */
export function orderSkillGroups(role: Role): SkillGroup[] {
  const seen = new Set<SkillGroup>();
  const out: SkillGroup[] = [];
  for (const g of [...role.skillGroupOrder, ...SKILL_GROUPS]) {
    if (!seen.has(g)) {
      seen.add(g);
      out.push(g);
    }
  }
  return out;
}
