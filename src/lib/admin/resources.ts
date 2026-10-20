// Describes each editable list for the admin: its table, schema, form fields and row mappers.
// The list page, the form and the server actions are all driven by this file.

import type { z } from "zod";
import {
  activitySchema,
  CERT_TOPICS,
  certificateSchema,
  educationSchema,
  experienceSchema,
  projectSchema,
  SKILL_GROUPS,
  skillSchema,
  whyCardSchema,
} from "@/content/schema";
import type { TableName } from "@/lib/data/columns";
import {
  activityToRow,
  certificateToRow,
  educationToRow,
  experienceToRow,
  projectToRow,
  rowToActivity,
  rowToCertificate,
  rowToEducation,
  rowToExperience,
  rowToProject,
  rowToSkill,
  rowToWhyCard,
  skillToRow,
  whyCardToRow,
  type SkillLinkRow,
} from "@/lib/data/mappers";
import type { UploadKind } from "./upload";

export const RESOURCE_KEYS = [
  "experiences",
  "projects",
  "skills",
  "certificates",
  "activities",
  "education",
  "why_cards",
] as const;
export type ResourceKey = (typeof RESOURCE_KEYS)[number];

export function isResourceKey(value: string): value is ResourceKey {
  return (RESOURCE_KEYS as readonly string[]).includes(value);
}

/** `virtual` fields are edited in the form but stored elsewhere (e.g. skill_links), not in the item. */
type Base = {
  name: string;
  label: string;
  hint?: string;
  virtual?: true;
  /** Forces the * marker when the kind is optional by default (e.g. a required upload). */
  required?: true;
};
export type FieldSpec = Base &
  (
    | { kind: "text" | "url" | "month" | "date"; nullable?: boolean }
    | { kind: "i18n"; multiline?: boolean; nullable?: boolean }
    | { kind: "boolean" }
    | { kind: "select"; options: readonly string[] }
    | { kind: "tags"; suggest?: "skills" }
    | { kind: "upload"; upload: UploadKind }
    | { kind: "caseStudy" | "links" | "colors" | "stat" }
    | { kind: "relations"; source: "experiences" | "projects" }
    | { kind: "order"; source: "experiences" | "skillGroups" }
    | { kind: "skills" }
    | { kind: "evidence"; nullable: true }
  );

type AnyRow = Record<string, unknown>;

export type Resource = {
  label: string;
  table: Exclude<TableName, "profile" | "roles" | "skill_links">;
  schema: z.ZodObject;
  /** Item fields shown as columns in the list. */
  listColumns: string[];
  fields: FieldSpec[];
  /** Long forms are split into titled sections (fields not listed go to the end). */
  sections?: { id: string; title: string; fields: string[] }[];
  hasPublished: boolean;
  toRow: (item: AnyRow) => AnyRow;
  fromRow: (row: AnyRow, links: SkillLinkRow[]) => AnyRow;
};

// The schema validates every item before toRow runs, so these widenings are safe.
const toRows = <T, R>(fn: (item: T) => R) => fn as unknown as Resource["toRow"];
const fromRows = <R, T>(fn: (row: R, links: SkillLinkRow[]) => T) =>
  fn as unknown as Resource["fromRow"];

const idField: FieldSpec = {
  name: "id",
  label: "ID (kebab-case, không đổi sau khi tạo)",
  kind: "text",
};
const published: FieldSpec = {
  name: "published",
  label: "Hiển thị trên trang",
  kind: "boolean",
};

export const resources: Record<ResourceKey, Resource> = {
  experiences: {
    label: "Kinh nghiệm",
    table: "experiences",
    schema: experienceSchema,
    listColumns: ["company", "start", "end"],
    hasPublished: true,
    toRow: toRows(experienceToRow),
    sections: [
      {
        id: "info",
        title: "Thông tin",
        fields: [
          "id",
          "company",
          "parentCompany",
          "location",
          "position",
          "start",
          "end",
          "employmentType",
          "teamSize",
        ],
      },
      { id: "content", title: "Nội dung", fields: ["summary", "tech"] },
      { id: "case-study", title: "Case study", fields: ["caseStudy"] },
      {
        id: "links",
        title: "Liên kết & skills",
        fields: ["links", "skillIds"],
      },
      { id: "visibility", title: "Hiển thị", fields: ["published"] },
    ],
    fromRow: fromRows(rowToExperience),
    fields: [
      idField,
      { name: "company", label: "Công ty", kind: "text" },
      {
        name: "parentCompany",
        label: "Công ty mẹ",
        kind: "text",
        nullable: true,
      },
      { name: "location", label: "Địa điểm", kind: "text" },
      { name: "position", label: "Vị trí", kind: "i18n" },
      { name: "start", label: "Bắt đầu", kind: "month" },
      {
        name: "end",
        label: "Kết thúc (trống = hiện tại)",
        kind: "month",
        nullable: true,
      },
      {
        name: "employmentType",
        label: "Loại hình",
        kind: "select",
        options: ["full-time", "internship"],
      },
      { name: "summary", label: "Tóm tắt", kind: "i18n", multiline: true },
      { name: "caseStudy", label: "Case study", kind: "caseStudy" },
      { name: "teamSize", label: "Quy mô team", kind: "text", nullable: true },
      { name: "tech", label: "Công nghệ", kind: "tags", suggest: "skills" },
      { name: "links", label: "Liên kết", kind: "links" },
      {
        name: "skillIds",
        label: "Skills dùng ở đây",
        kind: "skills",
        virtual: true,
      },
      published,
    ],
  },
  projects: {
    label: "Dự án",
    table: "projects",
    schema: projectSchema,
    listColumns: ["title", "start", "end"],
    hasPublished: true,
    toRow: toRows(projectToRow),
    sections: [
      {
        id: "info",
        title: "Thông tin",
        fields: ["id", "title", "role", "start", "end"],
      },
      {
        id: "content",
        title: "Nội dung",
        fields: ["summary", "tech", "posterUrl", "videoUrl"],
      },
      { id: "case-study", title: "Case study", fields: ["caseStudy"] },
      {
        id: "links",
        title: "Liên kết & skills",
        fields: ["demoUrl", "repoUrls", "skillIds"],
      },
      { id: "visibility", title: "Hiển thị", fields: ["published"] },
    ],
    fromRow: fromRows(rowToProject),
    fields: [
      idField,
      { name: "title", label: "Tên dự án", kind: "text" },
      { name: "role", label: "Vai trò", kind: "i18n" },
      { name: "start", label: "Bắt đầu", kind: "month" },
      {
        name: "end",
        label: "Kết thúc (trống = đang làm)",
        kind: "month",
        nullable: true,
      },
      { name: "summary", label: "Tóm tắt", kind: "i18n", multiline: true },
      { name: "caseStudy", label: "Case study", kind: "caseStudy" },
      { name: "tech", label: "Công nghệ", kind: "tags", suggest: "skills" },
      { name: "demoUrl", label: "Link demo", kind: "url", nullable: true },
      { name: "repoUrls", label: "Link repo", kind: "tags" },
      {
        name: "posterUrl",
        label: "Ảnh poster",
        kind: "upload",
        upload: "image",
      },
      {
        name: "videoUrl",
        label: "Video khi rê chuột",
        kind: "upload",
        upload: "video",
      },
      {
        name: "skillIds",
        label: "Skills dùng ở đây",
        kind: "skills",
        virtual: true,
      },
      published,
    ],
  },
  skills: {
    label: "Kỹ năng",
    table: "skills",
    schema: skillSchema,
    listColumns: ["name", "group"],
    hasPublished: false,
    toRow: toRows(skillToRow),
    fromRow: fromRows(rowToSkill),
    fields: [
      idField,
      { name: "name", label: "Tên", kind: "text" },
      { name: "group", label: "Nhóm", kind: "select", options: SKILL_GROUPS },
      {
        name: "experienceIds",
        label: "Bằng chứng: kinh nghiệm",
        kind: "relations",
        source: "experiences",
      },
      {
        name: "projectIds",
        label: "Bằng chứng: dự án",
        kind: "relations",
        source: "projects",
      },
    ],
  },
  certificates: {
    label: "Chứng chỉ",
    table: "certificates",
    schema: certificateSchema,
    listColumns: ["name", "organization", "issueDate"],
    hasPublished: true,
    toRow: toRows(certificateToRow),
    fromRow: fromRows(rowToCertificate),
    fields: [
      idField,
      { name: "name", label: "Tên chứng chỉ", kind: "text" },
      { name: "organization", label: "Tổ chức cấp", kind: "text" },
      { name: "issueDate", label: "Ngày cấp", kind: "date" },
      {
        name: "credentialId",
        label: "Mã chứng chỉ",
        kind: "text",
        nullable: true,
      },
      {
        name: "credentialUrl",
        label: "Link xác minh",
        kind: "url",
        nullable: true,
      },
      {
        name: "fileUrl",
        label: "Tệp chứng chỉ (PDF)",
        kind: "upload",
        upload: "pdf",
      },
      { name: "topic", label: "Chủ đề", kind: "select", options: CERT_TOPICS },
      {
        name: "skills",
        label: "Kỹ năng liên quan",
        kind: "tags",
        suggest: "skills",
      },
      { name: "description", label: "Mô tả", kind: "i18n", multiline: true },
      published,
    ],
  },
  activities: {
    label: "Hoạt động",
    table: "activities",
    schema: activitySchema,
    listColumns: ["id", "date"],
    hasPublished: false,
    toRow: toRows(activityToRow),
    fromRow: fromRows(rowToActivity),
    fields: [
      idField,
      { name: "name", label: "Tên hoạt động", kind: "i18n" },
      { name: "date", label: "Ngày", kind: "date" },
      { name: "skills", label: "Kỹ năng", kind: "tags", suggest: "skills" },
      { name: "description", label: "Mô tả", kind: "i18n", multiline: true },
    ],
  },
  education: {
    label: "Học vấn",
    table: "education",
    schema: educationSchema,
    listColumns: ["school", "start", "end"],
    hasPublished: false,
    toRow: toRows(educationToRow),
    fromRow: fromRows(rowToEducation),
    fields: [
      idField,
      { name: "school", label: "Trường", kind: "text" },
      { name: "degree", label: "Bằng cấp", kind: "i18n" },
      { name: "major", label: "Chuyên ngành", kind: "i18n" },
      { name: "start", label: "Bắt đầu", kind: "month" },
      { name: "end", label: "Kết thúc", kind: "month", nullable: true },
      { name: "gpa", label: "GPA", kind: "text", nullable: true },
      {
        name: "notes",
        label: "Ghi chú",
        kind: "i18n",
        multiline: true,
        nullable: true,
      },
    ],
  },
  why_cards: {
    label: "Why hire me",
    table: "why_cards",
    schema: whyCardSchema,
    listColumns: ["id", "evidenceLink"],
    hasPublished: false,
    toRow: toRows(whyCardToRow),
    fromRow: fromRows(rowToWhyCard),
    fields: [
      idField,
      { name: "title", label: "Tiêu đề", kind: "i18n" },
      { name: "subtitle", label: "Phụ đề", kind: "i18n" },
      { name: "tag", label: "Nhãn", kind: "i18n" },
      { name: "body", label: "Nội dung", kind: "i18n", multiline: true },
      { name: "colors", label: "Màu gradient", kind: "colors" },
      {
        name: "evidenceLink",
        label: "Liên kết bằng chứng",
        kind: "evidence",
        nullable: true,
      },
      { name: "stat", label: "Con số nổi bật", kind: "stat" },
    ],
  },
};

export function i18nFields(key: ResourceKey): string[] {
  return resources[key].fields
    .filter((f) => f.kind === "i18n")
    .map((f) => f.name);
}
