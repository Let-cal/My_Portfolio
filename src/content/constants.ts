/** Lightweight values shared with client components; keep runtime validation in schema.ts. */
export const LOCALES = ["en", "ja", "vi"] as const;
export const ROLE_KEYS = ["fullstack", "techlead", "pm"] as const;
export const KOI_VARIETIES = ["kohaku", "showa", "ogon"] as const;
export const SKILL_GROUPS = [
  "languages",
  "frameworks",
  "cloud",
  "ai",
  "databases",
  "delivery",
  "testing",
  "design",
] as const;
export const CERT_TOPICS = [
  "language",
  "pm",
  "design",
  "engineering",
  "other",
] as const;
