// Turns Zod issues into one clear Vietnamese message per input, using the form's field labels.
// The public content schema stays as is; only the admin decides how to explain its rules.
import type { FieldErrors, Resolver } from "react-hook-form";
import type { ZodObject } from "zod";
import type { FieldSpec } from "./resources";

export type Locale = "en" | "ja" | "vi";
export type FieldError = {
  path: string;
  field: string;
  locale?: Locale;
  message: string;
};
type Issue = { path: readonly PropertyKey[]; code: string; message: string };

const OPTIONAL_KINDS = new Set([
  "upload",
  "boolean",
  "tags",
  "links",
  "relations",
  "order",
  "skills",
  "caseStudy",
  "stat",
  "where",
  "derived",
  "roles",
]);

/** Whether the form must mark this field with `*`. */
export function isRequired(f: FieldSpec): boolean {
  if (f.required) return true;
  if (f.virtual || OPTIONAL_KINDS.has(f.kind)) return false;
  return !("nullable" in f && f.nullable);
}

const CASE_STUDY_PART: Record<string, string> = {
  problem: "Vấn đề",
  role: "Vai trò",
  decisions: "Quyết định",
  result: "Kết quả",
};
const LOCALES = new Set<string>(["en", "ja", "vi"]);

/** "Kết thúc (trống = hiện tại)" → "Kết thúc"; keeps acronyms such as "ID". */
function clean(label: string): string {
  return label.replace(/\s*\(.*\)\s*$/, "").trim();
}
/** Lowercases the first letter for use mid-sentence, unless the first word is an acronym or brand ("ID", "GitHub"). */
function lower(label: string): string {
  const s = clean(label);
  const rest = (s.split(" ")[0] ?? "").slice(1);
  return rest && rest === rest.toLowerCase()
    ? s[0].toLowerCase() + s.slice(1)
    : s;
}

function get(values: unknown, path: readonly PropertyKey[]): unknown {
  return path.reduce<unknown>(
    (v, k) => (v == null ? undefined : (v as Record<PropertyKey, unknown>)[k]),
    values,
  );
}
const isBlank = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** The field that owns a path: the longest field name that is a prefix of it (handles "summaries.pm"). */
function ownerOf(path: string[], fields: FieldSpec[]): FieldSpec | undefined {
  for (let n = path.length; n > 0; n--) {
    const name = path.slice(0, n).join(".");
    const f = fields.find((x) => x.name === name);
    if (f) return f;
  }
  return undefined;
}

function message(
  f: FieldSpec,
  rest: string[],
  blank: boolean,
  value: unknown,
): string {
  const locale =
    rest.at(-1) && LOCALES.has(rest.at(-1)!)
      ? ` (${rest.at(-1)!.toUpperCase()})`
      : "";
  const label = clean(f.label);

  if (f.name === "id")
    return blank
      ? "Nhập ID"
      : "ID chỉ gồm chữ thường không dấu, số và dấu gạch ngang (ví dụ: aws-saa)";
  if (f.name === "evidenceLink")
    return "Chọn một kinh nghiệm hoặc dự án làm bằng chứng";
  // A project's kind must match its link: both come from the "Thuộc về" select.
  if (
    f.kind === "where" ||
    (f.kind === "derived" && f.target === "experienceId")
  )
    return "Loại dự án không khớp với mục “Thuộc về”. Chọn lại nơi dự án thuộc về.";

  switch (f.kind) {
    case "i18n":
      return `Nhập ${lower(f.label)}${locale}`;
    case "caseStudy":
      return `Nhập ${CASE_STUDY_PART[rest[0]] ?? "nội dung"} của case study${locale}`;
    case "stat":
      return rest[0] === "label"
        ? `Nhập chú thích của con số${locale}`
        : "Nhập giá trị con số";
    case "links":
      return rest.at(-1) === "label"
        ? "Nhập nhãn liên kết"
        : "URL của liên kết phải bắt đầu bằng https://";
    case "colors":
      return "Màu phải có dạng #RRGGBB";
    case "month":
      return `Chọn tháng ${lower(f.label)}`;
    case "date":
      return blank
        ? `Chọn ${lower(f.label)}`
        : `${label} phải có dạng ngày/tháng/năm`;
    case "url":
      return blank
        ? `Nhập ${lower(f.label)}`
        : `${label} phải là đường dẫn đầy đủ, bắt đầu bằng https://`;
    case "select":
    case "relations":
    case "order":
    case "roles":
      return `Chọn ${lower(f.label)}`;
    case "tags":
      return rest.length
        ? `"${String(value ?? "")}" trong ${lower(f.label)} phải là đường dẫn đầy đủ, bắt đầu bằng https://`
        : `${label} chưa hợp lệ`;
    case "upload":
      return `Tải lên ${lower(f.label)}`;
    case "text":
      if (blank) return `Nhập ${lower(f.label)}`;
      if (/email/i.test(f.name)) return `${label} phải là địa chỉ email hợp lệ`;
      if (/url|github|linkedin/i.test(f.name))
        return `${label} phải là đường dẫn đầy đủ, bắt đầu bằng https://`;
      return `${label} chưa đúng định dạng${f.hint ? ` (${f.hint})` : ""}`;
    default:
      return `${label} chưa hợp lệ`;
  }
}

/** One message per failing path, in the order the fields appear in the form. */
export function describeIssues(
  issues: readonly Issue[],
  fields: FieldSpec[],
  values: unknown,
): FieldError[] {
  const seen = new Set<string>();
  const out: (FieldError & { order: number })[] = [];
  for (const issue of issues) {
    const parts = issue.path.map(String);
    const path = parts.join(".");
    if (seen.has(path)) continue;
    seen.add(path);
    const f = ownerOf(parts, fields);
    if (!f) {
      out.push({
        path,
        field: parts[0] ?? "",
        message: issue.message,
        order: Number.MAX_SAFE_INTEGER,
      });
      continue;
    }
    const rest = parts.slice(f.name.split(".").length);
    const last = rest.at(-1);
    out.push({
      path,
      field: f.name,
      locale: last && LOCALES.has(last) ? (last as Locale) : undefined,
      message: message(
        f,
        rest,
        isBlank(get(values, issue.path)),
        get(values, issue.path),
      ),
      order: fields.indexOf(f),
    });
  }
  return out
    .sort((a, b) => a.order - b.order)
    .map(({ path, field, locale, message }) => ({
      path,
      field,
      locale,
      message,
    }));
}

/** react-hook-form resolver: validate with the schema, report errors with the messages above. */
export function adminResolver(
  schema: ZodObject,
  fields: FieldSpec[],
): Resolver<Record<string, unknown>> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success)
      return { values: result.data as Record<string, unknown>, errors: {} };
    const errors: Record<string, unknown> = {};
    for (const e of describeIssues(result.error.issues, fields, values)) {
      const keys = e.path.split(".");
      let node = errors;
      for (const k of keys.slice(0, -1))
        node = (node[k] ??= {}) as Record<string, unknown>;
      node[keys.at(-1)!] = { type: "validate", message: e.message };
    }
    return {
      values: {},
      errors: errors as FieldErrors<Record<string, unknown>>,
    };
  };
}

/** Errors currently held by react-hook-form, flattened to paths, in the form's field order. */
export function flattenErrors(
  errors: FieldErrors,
  fields: FieldSpec[],
): FieldError[] {
  const out: FieldError[] = [];
  const walk = (node: unknown, path: string[]) => {
    if (!node || typeof node !== "object") return;
    const message = (node as { message?: unknown }).message;
    if (typeof message === "string" && message) {
      const f = ownerOf(path, fields);
      const last = path.at(-1);
      out.push({
        path: path.join("."),
        field: f?.name ?? path[0],
        locale: last && LOCALES.has(last) ? (last as Locale) : undefined,
        message,
      });
      return;
    }
    for (const [k, v] of Object.entries(node))
      if (k !== "ref" && k !== "type") walk(v, [...path, k]);
  };
  walk(errors, []);
  const order = (e: FieldError) => {
    const i = fields.findIndex((f) => f.name === e.field);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return out.sort((a, b) => order(a) - order(b));
}
