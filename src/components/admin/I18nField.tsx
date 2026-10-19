"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type I18nValue = { en: string; ja: string; vi: string };
const LOCALES = ["en", "ja", "vi"] as const;
export const EMPTY_I18N: I18nValue = { en: "", ja: "", vi: "" };

/** One text in three languages, side by side; a missing translation is flagged. */
export function I18nField({
  label,
  value,
  onChange,
  multiline,
  error,
}: {
  label: string;
  value: I18nValue;
  onChange: (value: I18nValue) => void;
  multiline?: boolean;
  error?: string;
}) {
  const id = useId();
  const missing = LOCALES.filter((l) => !value[l]?.trim());
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 flex items-center gap-2 text-sm font-medium">
        {label}
        {missing.length > 0 && missing.length < 3 && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-300">
            Thiếu: {missing.map((l) => l.toUpperCase()).join(", ")}
          </span>
        )}
      </legend>
      <div className="grid gap-2 md:grid-cols-3">
        {LOCALES.map((locale) => {
          const props = {
            id: `${id}-${locale}`,
            lang: locale,
            value: value[locale] ?? "",
            "aria-label": `${label} (${locale.toUpperCase()})`,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              onChange({ ...value, [locale]: e.target.value }),
          };
          return (
            <label key={locale} className="flex flex-col gap-1 text-xs text-muted-foreground">
              {locale.toUpperCase()}
              {multiline ? <Textarea rows={4} {...props} /> : <Input {...props} />}
            </label>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}
