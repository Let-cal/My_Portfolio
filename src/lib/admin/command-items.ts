// Entries for the admin ⌘K palette: screens, every item, quick creates and the public site.
import type { AdminContent } from "./health";
import { RESOURCE_KEYS, resources, type ResourceKey } from "./resources";

export type CommandItem = {
  group: string;
  label: string;
  href: string;
  keywords: string;
};

const SINGULAR: Record<ResourceKey, string> = {
  experiences: "kinh nghiệm",
  projects: "dự án",
  skills: "kỹ năng",
  certificates: "chứng chỉ",
  activities: "hoạt động",
  education: "học vấn",
  why_cards: "why card",
};
const TYPE: Record<ResourceKey, string> = {
  experiences: "Kinh nghiệm",
  projects: "Dự án",
  skills: "Kỹ năng",
  certificates: "Chứng chỉ",
  activities: "Hoạt động",
  education: "Học vấn",
  why_cards: "Why card",
};

function labelOf(key: ResourceKey, item: Record<string, unknown>): string {
  const pick = (v: unknown) =>
    typeof v === "string" ? v : ((v as { en?: string } | null)?.en ?? "");
  const text =
    key === "experiences"
      ? item.company
      : key === "projects"
        ? item.title
        : key === "education"
          ? item.school
          : key === "activities" || key === "why_cards"
            ? pick(item.name ?? item.title)
            : item.name;
  return pick(text) || String(item.id);
}

const LIST_OF: Record<ResourceKey, keyof AdminContent> = {
  experiences: "experiences",
  projects: "projects",
  skills: "skills",
  certificates: "certificates",
  activities: "activities",
  education: "education",
  why_cards: "whyCards",
};

export function buildCommandItems(c: AdminContent): CommandItem[] {
  const screens: CommandItem[] = [
    {
      group: "Đi tới",
      label: "Tổng quan",
      href: "/admin",
      keywords: "dashboard home",
    },
    {
      group: "Đi tới",
      label: "Hồ sơ",
      href: "/admin/profile",
      keywords: "profile",
    },
    {
      group: "Đi tới",
      label: "Vai trò & CV",
      href: "/admin/roles",
      keywords: "roles cv",
    },
    ...RESOURCE_KEYS.map((key) => ({
      group: "Đi tới",
      label: resources[key].label,
      href: `/admin/${key}`,
      keywords: key,
    })),
    {
      group: "Đi tới",
      label: "Kỹ năng chưa có bằng chứng",
      href: "/admin/skills?filter=orphan",
      keywords: "orphan matrix",
    },
  ];
  const create = RESOURCE_KEYS.map((key) => ({
    group: "Tạo mới",
    label: `Tạo ${SINGULAR[key]} mới`,
    href: `/admin/${key}/new`,
    keywords: `new create them moi ${key}`,
  }));
  const items = RESOURCE_KEYS.flatMap((key) =>
    (c[LIST_OF[key]] as unknown as Record<string, unknown>[]).map((item) => ({
      group: "Nội dung",
      label: `${TYPE[key]} · ${labelOf(key, item)}`,
      href: `/admin/${key}/${String(item.id)}`,
      keywords: String(item.id),
    })),
  );
  const site = (["en", "ja", "vi"] as const).map((l) => ({
    group: "Trang công khai",
    label: `Trang công khai (${l.toUpperCase()})`,
    href: `/${l}`,
    keywords: "site public view",
  }));
  return [...screens, ...create, ...items, ...site];
}
