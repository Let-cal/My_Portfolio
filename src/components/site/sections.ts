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
