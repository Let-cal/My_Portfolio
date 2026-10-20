// What deleting one item takes with it, shown in the confirm dialog before the delete.
import type { AdminContent } from "./health";
import type { ResourceKey } from "./resources";

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

  if (key === "experiences" || key === "projects") {
    const anchor = key === "experiences" ? `#exp-${id}` : `#proj-${id}`;
    for (const w of c.whyCards) {
      if (w.evidenceLink === anchor)
        lines.push(`Why card "${w.title.en}" đang trỏ tới mục này`);
    }
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
