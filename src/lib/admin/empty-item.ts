// Starting values for a new item. A plain module, not a client one, so server pages can call it.
import { resources, type ResourceKey } from "./resources";

const EMPTY_I18N = { en: "", ja: "", vi: "" };

/** Empty values for a new item, one per field kind. */
export function emptyItem(key: ResourceKey): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of resources[key].fields) {
    values[f.name] =
      f.kind === "i18n" ? (f.nullable ? null : { ...EMPTY_I18N })
      : f.kind === "boolean" ? true
      : f.kind === "select" ? f.options[0]
      : f.kind === "tags" || f.kind === "links" || f.kind === "relations" || f.kind === "order" || f.kind === "skills" ? []
      : f.kind === "colors" ? ["#0ea5e9", "#e0a84e"]
      : f.kind === "text" || f.kind === "url" || f.kind === "month" || f.kind === "date" ? (f.nullable ? null : "")
      : null;
  }
  return values;
}
