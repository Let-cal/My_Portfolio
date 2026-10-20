"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ComboOption = { value: string; label: string; group?: string };

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();

/**
 * A text input with a filtered, grouped suggestion list (ARIA combobox pattern).
 * Arrow keys move through suggestions, Enter picks the active one or, with `onEnterText`,
 * the typed text itself. Escape closes the list.
 */
export function Combobox({
  id: inputId,
  error,
  label,
  options,
  onPick,
  onEnterText,
  placeholder,
}: {
  id?: string;
  error?: string;
  label: string;
  options: ComboOption[];
  onPick: (value: string) => void;
  onEnterText?: (text: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const q = fold(query.trim());
  const matches = q
    ? options.filter((o) => fold(o.label).includes(q)).slice(0, 30)
    : [];
  const groups = [...new Set(matches.map((m) => m.group ?? ""))];
  const ordered = groups.flatMap((g) =>
    matches.filter((m) => (m.group ?? "") === g),
  );

  function pick(value: string) {
    onPick(value);
    setQuery("");
    setActive(-1);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) =>
        ordered.length ? (i + step + ordered.length) % ordered.length : -1,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && ordered[active]) pick(ordered[active].value);
      else if (onEnterText && query.trim()) {
        onEnterText(query.trim());
        setQuery("");
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && ordered.length > 0;
  return (
    <div className="relative">
      <Input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error && inputId ? `${inputId}-error` : undefined}
        className={error ? "border-destructive" : undefined}
        role="combobox"
        aria-label={label}
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {groups.map((g) => (
            <li key={g} role="presentation">
              {g && (
                <div className="px-2 pt-1.5 pb-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {g}
                </div>
              )}
              <ul role="group" aria-label={g || undefined}>
                {ordered
                  .map((o, index) => ({ o, index }))
                  .filter(({ o }) => (o.group ?? "") === g)
                  .map(({ o, index }) => (
                    <li
                      key={o.value}
                      id={`${id}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(o.value)}
                      className={cn(
                        "cursor-pointer rounded px-2 py-1 text-sm",
                        index === active ? "bg-muted" : "hover:bg-muted",
                      )}
                    >
                      {o.label}
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
