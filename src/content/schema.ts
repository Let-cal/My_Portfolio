import { z } from "zod";
import {
  LOCALES,
  ROLE_KEYS,
  KOI_VARIETIES,
  SKILL_GROUPS,
  CERT_TOPICS,
} from "./constants";
export {
  LOCALES,
  ROLE_KEYS,
  KOI_VARIETIES,
  SKILL_GROUPS,
  CERT_TOPICS,
} from "./constants";

// Shared content model for the public site, the admin CRUD and the Supabase mappers.
// Every type below is z.infer of the schema with the matching name.

export const localeSchema = z.enum(LOCALES);
export const roleKeySchema = z.enum(ROLE_KEYS);
export const koiVarietySchema = z.enum(KOI_VARIETIES);
export const skillGroupSchema = z.enum(SKILL_GROUPS);
export const certTopicSchema = z.enum(CERT_TOPICS);

export type Locale = z.infer<typeof localeSchema>;
export type RoleKey = z.infer<typeof roleKeySchema>;
export type KoiVariety = z.infer<typeof koiVarietySchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
export type CertTopic = z.infer<typeof certTopicSchema>;

/** Display text in 3 languages. EN is required; JA/VI fall back to EN when missing. */
export const i18nText = z.object({
  en: z.string().min(1),
  ja: z.string().optional(),
  vi: z.string().optional(),
});
export const i18nTextSchema = i18nText;

/** Like i18nText, but EN may be empty (a summary that is filled in only for JA/VI, or not at all). */
const i18nTextOptionalEn = z.object({
  en: z.string(),
  ja: z.string().optional(),
  vi: z.string().optional(),
});
export type I18nText = z.infer<typeof i18nText>;

/** 'YYYY-MM' */
export const yearMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM");
/** 'YYYY-MM-DD' */
export const isoDate = z
  .string()
  .regex(
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
    "Expected YYYY-MM-DD",
  );
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected #RRGGBB");
const id = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Expected a kebab-case id");

// No phone field: the site never shows a phone number. `.strict()` rejects unknown keys.
export const profileSchema = z
  .object({
    name: z.string().min(1),
    location: z.string().min(1),
    email: z.string().email(),
    linkedin: z.string().url(),
    github: z.string().url(),
    avatarUrl: z.string().nullable(),
    openToWork: z.boolean(),
    availabilityNote: i18nText,
    bookingUrl: z.string().url().nullable(),
    summaries: z.object({
      fullstack: i18nText,
      techlead: i18nText,
      pm: i18nText,
    }),
  })
  .strict();
export type Profile = z.infer<typeof profileSchema>;

export const roleSchema = z.object({
  key: roleKeySchema,
  title: i18nText,
  koiVariety: koiVarietySchema,
  cvFileUrl: z.string().min(1),
  experienceOrder: z.array(z.string()),
  skillGroupOrder: z.array(skillGroupSchema),
});
export type Role = z.infer<typeof roleSchema>;

export const caseStudySchema = z.object({
  problem: i18nText,
  role: i18nText,
  decisions: i18nText,
  result: i18nText,
});
export type CaseStudy = z.infer<typeof caseStudySchema>;

export const linkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});
export type Link = z.infer<typeof linkSchema>;

export const experienceSchema = z.object({
  id,
  company: z.string().min(1),
  parentCompany: z.string().nullable(),
  location: z.string().min(1),
  position: i18nText,
  start: yearMonth,
  end: yearMonth.nullable(),
  employmentType: z.enum(["full-time", "internship"]),
  summary: i18nTextOptionalEn,
  caseStudy: caseStudySchema.nullable(),
  teamSize: z.string().nullable(),
  tech: z.array(z.string()),
  links: z.array(linkSchema),
  published: z.boolean(),
  sortIndex: z.number().int(),
});
export type Experience = z.infer<typeof experienceSchema>;

export const PROJECT_KINDS = ["work", "university", "personal"] as const;
export const projectKindSchema = z.enum(PROJECT_KINDS);
export type ProjectKind = z.infer<typeof projectKindSchema>;

/**
 * A project belongs to one company stint (`work`), one school (`university`) or nobody
 * (`personal`). `kind` must agree with which link is set.
 */
export const projectSchema = z
  .object({
    id,
    title: z.string().min(1),
    role: i18nText,
    start: yearMonth,
    end: yearMonth.nullable(),
    summary: i18nText,
    caseStudy: caseStudySchema.nullable(),
    tech: z.array(z.string()),
    demoUrl: z.string().url().nullable(),
    repoUrls: z.array(z.string().url()),
    posterUrl: z.string().nullable(),
    videoUrl: z.string().nullable(),
    published: z.boolean(),
    sortIndex: z.number().int(),
    experienceId: z.string().nullable().default(null),
    educationId: z.string().nullable().default(null),
    kind: projectKindSchema.default("personal"),
    featured: z.boolean().default(false),
    featuredOrder: z.number().int().nullable().default(null),
    roles: z.array(roleKeySchema).default([]),
    teamSize: z.string().nullable().default(null),
    links: z.array(linkSchema).default([]),
  })
  .superRefine((p, ctx) => {
    const ok =
      (p.kind === "work" &&
        p.experienceId !== null &&
        p.educationId === null) ||
      (p.kind === "university" &&
        p.educationId !== null &&
        p.experienceId === null) ||
      (p.kind === "personal" &&
        p.experienceId === null &&
        p.educationId === null);
    if (!ok) {
      ctx.addIssue({
        code: "custom",
        path: ["kind"],
        message: "kind must match where the project belongs",
      });
    }
  });
export type Project = z.infer<typeof projectSchema>;

export const skillSchema = z.object({
  id,
  name: z.string().min(1),
  group: skillGroupSchema,
  sortIndex: z.number().int(),
  experienceIds: z.array(z.string()),
  projectIds: z.array(z.string()),
});
export type Skill = z.infer<typeof skillSchema>;

export const certificateSchema = z.object({
  id,
  name: z.string().min(1),
  organization: z.string().min(1),
  issueDate: isoDate,
  credentialId: z.string().nullable(),
  credentialUrl: z.string().url().nullable(),
  fileUrl: z.string().nullable(),
  topic: certTopicSchema,
  skills: z.array(z.string()),
  description: i18nText,
  published: z.boolean(),
  sortIndex: z.number().int(),
});
export type Certificate = z.infer<typeof certificateSchema>;

export const activitySchema = z.object({
  id,
  name: i18nText,
  date: isoDate,
  skills: z.array(z.string()),
  description: i18nText,
  sortIndex: z.number().int(),
});
export type Activity = z.infer<typeof activitySchema>;

export const educationSchema = z.object({
  id,
  school: z.string().min(1),
  degree: i18nText,
  major: i18nText,
  start: yearMonth,
  end: yearMonth.nullable(),
  gpa: z.string().nullable(),
  notes: i18nText.nullable(),
  sortIndex: z.number().int(),
});
export type Education = z.infer<typeof educationSchema>;

/** One real number shown on a why-card, counted up by a NumberTicker. `prefix` carries the "~" of an estimate. */
export const whyStatSchema = z.object({
  value: z.number(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  label: i18nText,
});
export type WhyStat = z.infer<typeof whyStatSchema>;

export const whyCardSchema = z.object({
  id,
  title: i18nText,
  subtitle: i18nText,
  tag: i18nText,
  body: i18nText,
  colors: z.tuple([hexColor, hexColor]),
  evidenceLink: z
    .string()
    .regex(
      /^#(exp|proj|tree)-[a-z0-9]+(-[a-z0-9]+)*$/,
      "Expected #exp-<id>, #proj-<id> or #tree-<id>",
    )
    .nullable(),
  stat: whyStatSchema.nullable().default(null),
  sortIndex: z.number().int(),
});
export type WhyCard = z.infer<typeof whyCardSchema>;

export const contentSchema = z.object({
  profile: profileSchema,
  roles: roleSchema.array().length(3),
  experiences: experienceSchema.array(),
  projects: projectSchema.array(),
  skills: skillSchema.array(),
  certificates: certificateSchema.array(),
  activities: activitySchema.array(),
  education: educationSchema.array(),
  whyCards: whyCardSchema.array(),
});
export type Content = z.infer<typeof contentSchema>;
