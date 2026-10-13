/** Anchor ids of the seven page sections, shared by the header, the command palette and the 3D scene. */
export const SECTION_IDS = [
  "hero",
  "experience",
  "projects",
  "skills",
  "certificates",
  "why",
  "contact",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

/** Chapter number and Japanese chapter label shown beside each numbered section (the hero has none). */
export const SECTION_CHAPTERS = {
  experience: { index: "01", kanji: "第一章 経歴" },
  projects: { index: "02", kanji: "第二章 制作" },
  skills: { index: "03", kanji: "第三章 技術" },
  certificates: { index: "04", kanji: "第四章 資格" },
  why: { index: "05", kanji: "第五章 強み" },
  contact: { index: "06", kanji: "第六章 連絡" },
} as const satisfies Partial<Record<SectionId, { index: string; kanji: string }>>;
