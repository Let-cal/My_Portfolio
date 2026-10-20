// Content history: what one saved version looks like, and how it differs from the current row.
import { resources, type ResourceKey } from "./resources";

export type Version = {
  id: number;
  op: "update" | "delete";
  oldRow: Record<string, unknown>;
  changedBy: string | null;
  changedAt: string;
};

export type DiffLine = { field: string; before: string; after: string };

/** Bookkeeping columns: they change on every save or reorder and say nothing to the editor. */
const SKIPPED = new Set(["created_at", "updated_at", "sort_index"]);
const EMPTY = "—";

function text(value: unknown): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Dotted leaves: `summary.ja`, `summaries.pm.en`; arrays stay one leaf, joined with ", ". */
function flatten(value: unknown, prefix: string, out: Map<string, string>) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (!prefix && SKIPPED.has(k)) continue;
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else if (Array.isArray(value)) {
    out.set(prefix, value.length ? value.map(text).join(", ") : EMPTY);
  } else {
    out.set(prefix, text(value));
  }
}

/** The fields that differ between a saved version and the current row (null: the row is gone). */
export function diffRow(
  before: Record<string, unknown>,
  after: Record<string, unknown> | null,
): DiffLine[] {
  const was = new Map<string, string>();
  const now = new Map<string, string>();
  flatten(before, "", was);
  if (after) flatten(after, "", now);
  const fields = [...new Set([...was.keys(), ...now.keys()])];
  return fields
    .map((field) => ({
      field,
      before: was.get(field) ?? EMPTY,
      after: now.get(field) ?? EMPTY,
    }))
    .filter((line) => line.before !== line.after);
}

/** The database table whose history an admin screen shows. */
export function tableFor(key: ResourceKey | "profile" | "roles"): string {
  return key === "profile" || key === "roles" ? key : resources[key].table;
}
