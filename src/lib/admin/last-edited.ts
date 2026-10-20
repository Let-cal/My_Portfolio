// Turns the newest row of a content table into a "Sửa gần nhất" entry: what it is and where to edit it.
import { RESOURCE_KEYS, resources, type ResourceKey } from "./resources";

export type EditEntry = {
  kind: string;
  label: string;
  href: string;
  at: string;
};

const KIND: Record<ResourceKey, string> = {
  experiences: "Kinh nghiệm",
  projects: "Dự án",
  skills: "Kỹ năng",
  certificates: "Chứng chỉ",
  activities: "Hoạt động",
  education: "Học vấn",
  why_cards: "Why card",
};

const LABEL_COLUMNS = [
  "name",
  "title",
  "company",
  "school",
  "key",
  "id",
] as const;

const text = (v: unknown) =>
  typeof v === "object" && v !== null
    ? String((v as { en?: string }).en ?? "")
    : String(v);

export function describeEdit(
  table: string,
  row: Record<string, unknown>,
): EditEntry {
  const at = String(row.updated_at);
  if (table === "profile")
    return {
      kind: "Hồ sơ",
      label: text(row.name ?? "Hồ sơ"),
      href: "/admin/profile",
      at,
    };
  if (table === "roles")
    return { kind: "Vai trò", label: text(row.key), href: "/admin/roles", at };
  if (table === "skill_links") {
    const target = row.experience_id ?? row.project_id;
    return {
      kind: "Liên kết kỹ năng",
      label: `${text(row.skill_id)} ↔ ${text(target)}`,
      href: "/admin/skills",
      at,
    };
  }
  const key = RESOURCE_KEYS.find((k) => resources[k].table === table);
  const raw = LABEL_COLUMNS.map((c) => row[c]).find(
    (v) => v !== undefined && v !== null,
  );
  const label = text(raw) || String(row.id);
  if (!key) return { kind: table, label, href: "/admin", at };
  return {
    kind: KIND[key],
    label,
    href: `/admin/${key}/${String(row.id)}`,
    at,
  };
}
