// What deleting one item takes with it, shown in the confirm dialog before the delete.
import { journeyAnchors } from "@/lib/journey";
import type { AdminContent } from "./health";
import type { ResourceKey } from "./resources";

/**
 * Anchors that stop existing when `key`/`id` is deleted, with the `#`. A project loses its tree card
 * (`#tree-<id>`) and its home card (`#proj-<id>`). A stint or a school only loses its tree parent
 * (`#exp-<slug>`) when no other stint of the same company is left to keep that row alive.
 */
function lostAnchors(key: ResourceKey, id: string, c: AdminContent): string[] {
  if (key === "projects") return [`#tree-${id}`, `#proj-${id}`];
  if (key === "experiences") {
    const before = journeyAnchors(c).experiences;
    const parent = before.get(id);
    if (!parent) return [];
    const after = journeyAnchors({
      ...c,
      experiences: c.experiences.filter((e) => e.id !== id),
    }).experiences;
    return [...after.values()].includes(parent) ? [] : [`#${parent}`];
  }
  if (key === "education") {
    const parent = journeyAnchors(c).education.get(id);
    return parent ? [`#${parent}`] : [];
  }
  return [];
}

export function deleteImpact(
  key: ResourceKey,
  id: string,
  c: AdminContent,
): string[] {
  const lines: string[] = [];
  const links =
    key === "experiences"
      ? c.skills.filter((s) => s.experienceIds.includes(id)).length
      : key === "projects"
        ? c.skills.filter((s) => s.projectIds.includes(id)).length
        : key === "skills"
          ? (() => {
              const skill = c.skills.find((s) => s.id === id);
              return skill
                ? skill.experienceIds.length + skill.projectIds.length
                : 0;
            })()
          : 0;
  if (links > 0) lines.push(`Mất ${links} liên kết kỹ năng`);

  // A stint or a school with projects cannot be deleted at all: the foreign key refuses it.
  if (key === "experiences" || key === "education") {
    const attached = c.projects.filter((p) =>
      key === "experiences" ? p.experienceId === id : p.educationId === id,
    ).length;
    if (attached > 0)
      lines.push(
        `Còn ${attached} dự án thuộc mục này, phải chuyển hoặc xoá chúng trước (xoá sẽ bị từ chối)`,
      );
  }

  const lost = lostAnchors(key, id, c);
  for (const w of c.whyCards) {
    if (w.evidenceLink && lost.includes(w.evidenceLink))
      lines.push(`Why card "${w.title.en}" đang trỏ tới mục này`);
  }
  if (key === "experiences") {
    for (const r of c.roles) {
      if (r.experienceOrder.includes(id)) {
        lines.push(
          `Vai trò "${r.title.en}" có mục này trong thứ tự kinh nghiệm`,
        );
      }
    }
  }
  return lines;
}
