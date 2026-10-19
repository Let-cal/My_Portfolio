"use client";

import type { SkillGroup } from "@/content/schema";
import { Combobox } from "./Combobox";

export type SkillOption = { id: string; label: string; group: SkillGroup };

/** Chooses the skills an experience or project shows as evidence. Stored in skill_links. */
export function SkillPicker({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string[];
  onChange: (ids: string[]) => void;
  options: SkillOption[];
}) {
  const byId = new Map(options.map((o) => [o.id, o]));
  const available = options
    .filter((o) => !value.includes(o.id))
    .map((o) => ({ value: o.id, label: o.label, group: o.group }));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <li
              key={id}
              className="flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pr-1 pl-2.5 text-xs"
            >
              {byId.get(id)?.label ?? id}
              <button
                type="button"
                aria-label={`Bỏ ${byId.get(id)?.label ?? id}`}
                className="rounded-full px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onChange(value.filter((x) => x !== id))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <Combobox
        label={label}
        placeholder="Tìm skill để gắn…"
        options={available}
        onPick={(id) => onChange([...value, id])}
      />
    </fieldset>
  );
}
