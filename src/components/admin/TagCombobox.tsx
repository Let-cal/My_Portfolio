"use client";

import { Combobox } from "./Combobox";
import { FieldError } from "./FieldShell";

/** Free-text tags with suggestions (e.g. skill names for certificates). Enter keeps any text. */
export function TagCombobox({
  id,
  label,
  value,
  onChange,
  suggestions,
  error,
  invalidIndexes,
}: {
  /** Positions of chips that failed validation, outlined in red. */
  invalidIndexes?: ReadonlySet<number>;
  id?: string;
  error?: string;
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}) {
  const add = (tag: string) => {
    if (!value.some((v) => v.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tag, i) => (
            <li
              key={tag}
              className={
                invalidIndexes?.has(i)
                  ? "flex items-center gap-1 rounded-full border border-destructive bg-destructive/10 py-0.5 pr-1 pl-2.5 text-xs"
                  : "flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pr-1 pl-2.5 text-xs"
              }
            >
              {tag}
              <button
                type="button"
                aria-label={`Bỏ ${tag}`}
                className="rounded-full px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onChange(value.filter((v) => v !== tag))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <Combobox
        id={id}
        error={error}
        label={label}
        placeholder="Gõ để tìm, Enter để thêm"
        options={suggestions.filter((s) => !value.includes(s)).map((s) => ({ value: s, label: s }))}
        onPick={add}
        onEnterText={add}
      />
      {id && <FieldError id={id} message={error} />}
    </fieldset>
  );
}
