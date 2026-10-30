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

/**
 * Chapter number, Japanese chapter label and single-character kanji numeral of every section (spec 13.3 E3,
 * Emaki 5.5). The hero's "00" is never shown, only its kanji. The numerals mark the side rail's ink thread.
 */
export const SECTION_CHAPTERS: Record<
  SectionId,
  { index: string; kanji: string; numeral: string }
> = {
  hero: { index: "00", kanji: "序章", numeral: "序" },
  experience: { index: "01", kanji: "第一章 経歴", numeral: "一" },
  projects: { index: "02", kanji: "第二章 作品", numeral: "二" },
  skills: { index: "03", kanji: "第三章 技術", numeral: "三" },
  certificates: { index: "04", kanji: "第四章 資格", numeral: "四" },
  why: { index: "05", kanji: "第五章 昇龍", numeral: "五" },
  contact: { index: "06", kanji: "終章 連絡", numeral: "終" },
};
