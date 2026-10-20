// Single source of truth for the Supabase tables. `schema-sql.ts` renders the migration from
// this file, and tests check every column against the row mappers in `mappers.ts`.

export type SqlType = "text" | "text[]" | "jsonb" | "boolean" | "integer";

export type Column = {
  name: string;
  type: SqlType;
  nullable?: boolean;
  default?: string;
  /** Extra column constraint, e.g. a primary key or a foreign key. */
  constraint?: string;
};

export type Table = {
  columns: Column[];
  /** Rows with `published = false` are hidden from visitors. */
  hasPublished?: boolean;
  /** Extra table-level SQL placed after the column list. */
  tableConstraints?: string[];
};

const id: Column = { name: "id", type: "text", constraint: "primary key" };
const sortIndex: Column = { name: "sort_index", type: "integer", default: "0" };
const published: Column = {
  name: "published",
  type: "boolean",
  default: "true",
};
const startMonth: Column = { name: "start_month", type: "text" };
const endMonth: Column = { name: "end_month", type: "text", nullable: true };

export const TABLES = {
  profile: {
    columns: [
      {
        name: "id",
        type: "text",
        default: "'me'",
        constraint: "primary key check (id = 'me')",
      },
      { name: "name", type: "text" },
      { name: "location", type: "text" },
      { name: "email", type: "text" },
      { name: "linkedin", type: "text" },
      { name: "github", type: "text" },
      { name: "avatar_url", type: "text", nullable: true },
      { name: "open_to_work", type: "boolean", default: "true" },
      { name: "availability_note", type: "jsonb" },
      { name: "booking_url", type: "text", nullable: true },
      { name: "summaries", type: "jsonb" },
    ],
  },
  roles: {
    columns: [
      { name: "key", type: "text", constraint: "primary key" },
      { name: "title", type: "jsonb" },
      { name: "koi_variety", type: "text" },
      { name: "cv_file_url", type: "text" },
      { name: "experience_order", type: "text[]", default: "'{}'" },
      { name: "skill_group_order", type: "text[]", default: "'{}'" },
    ],
  },
  experiences: {
    hasPublished: true,
    columns: [
      id,
      { name: "company", type: "text" },
      { name: "parent_company", type: "text", nullable: true },
      { name: "location", type: "text" },
      { name: "position", type: "jsonb" },
      startMonth,
      endMonth,
      { name: "employment_type", type: "text" },
      { name: "summary", type: "jsonb" },
      { name: "case_study", type: "jsonb", nullable: true },
      { name: "team_size", type: "text", nullable: true },
      { name: "tech", type: "text[]", default: "'{}'" },
      { name: "links", type: "jsonb", default: "'[]'" },
      published,
      sortIndex,
    ],
  },
  projects: {
    hasPublished: true,
    columns: [
      id,
      { name: "title", type: "text" },
      { name: "role", type: "jsonb" },
      startMonth,
      endMonth,
      { name: "summary", type: "jsonb" },
      { name: "case_study", type: "jsonb", nullable: true },
      { name: "tech", type: "text[]", default: "'{}'" },
      { name: "demo_url", type: "text", nullable: true },
      { name: "repo_urls", type: "text[]", default: "'{}'" },
      { name: "poster_url", type: "text", nullable: true },
      { name: "video_url", type: "text", nullable: true },
      published,
      sortIndex,
    ],
  },
  skills: {
    columns: [
      id,
      { name: "name", type: "text" },
      { name: "skill_group", type: "text" },
      sortIndex,
    ],
  },
  skill_links: {
    columns: [
      {
        name: "skill_id",
        type: "text",
        constraint: "references public.skills (id) on delete cascade",
      },
      {
        name: "experience_id",
        type: "text",
        nullable: true,
        constraint: "references public.experiences (id) on delete cascade",
      },
      {
        name: "project_id",
        type: "text",
        nullable: true,
        constraint: "references public.projects (id) on delete cascade",
      },
    ],
    tableConstraints: [
      "check ((experience_id is null) <> (project_id is null))",
      "unique nulls not distinct (skill_id, experience_id, project_id)",
    ],
  },
  certificates: {
    hasPublished: true,
    columns: [
      id,
      { name: "name", type: "text" },
      { name: "organization", type: "text" },
      { name: "issue_date", type: "text" },
      { name: "credential_id", type: "text", nullable: true },
      { name: "credential_url", type: "text", nullable: true },
      { name: "file_url", type: "text", nullable: true },
      { name: "topic", type: "text" },
      { name: "skills", type: "text[]", default: "'{}'" },
      { name: "description", type: "jsonb" },
      published,
      sortIndex,
    ],
  },
  activities: {
    columns: [
      id,
      { name: "name", type: "jsonb" },
      { name: "event_date", type: "text" },
      { name: "skills", type: "text[]", default: "'{}'" },
      { name: "description", type: "jsonb" },
      sortIndex,
    ],
  },
  education: {
    columns: [
      id,
      { name: "school", type: "text" },
      { name: "degree", type: "jsonb" },
      { name: "major", type: "jsonb" },
      startMonth,
      endMonth,
      { name: "gpa", type: "text", nullable: true },
      { name: "notes", type: "jsonb", nullable: true },
      sortIndex,
    ],
  },
  why_cards: {
    columns: [
      id,
      { name: "title", type: "jsonb" },
      { name: "subtitle", type: "jsonb" },
      { name: "tag", type: "jsonb" },
      { name: "body", type: "jsonb" },
      { name: "colors", type: "text[]" },
      { name: "evidence_link", type: "text", nullable: true },
      { name: "stat", type: "jsonb", nullable: true },
      sortIndex,
    ],
  },
} satisfies Record<string, Table>;

export type TableName = keyof typeof TABLES;

/** Storage buckets for admin uploads; both are publicly readable. */
export const BUCKETS = ["media", "files"] as const;
