"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { a11yProps, FieldError, RequiredMark } from "./FieldShell";

export type I18nValue = { en: string; ja: string; vi: string };
export type I18nErrors = Partial<Record<keyof I18nValue, string>>;
const LOCALES = ["en", "ja", "vi"] as const;
export const EMPTY_I18N: I18nValue = { en: "", ja: "", vi: "" };

/**
 * One text in three languages, side by side. Each language box has its own id
 * (`<idPrefix>.<locale>`) and error, so the error summary can jump straight to it.
 * EN is the required one; JA and VI fall back to EN on the public site.
 */
export function I18nField({
  label,
  value,
  onChange,
  multiline,
  idPrefix,
  required,
  errors = {},
}: {
  label: string;
  value: I18nValue;
  onChange: (value: I18nValue) => void;
  multiline?: boolean;
  /** Input ids become `field-<idPrefix>.<locale>`. */
  idPrefix: string;
  required?: boolean;
  errors?: I18nErrors;
}) {
  const missing = LOCALES.filter((l) => !value[l]?.trim());
  return (
    <fieldset className="flex flex-col gap-2" data-field={`field-${idPrefix}`}>
      <legend className="mb-1 flex flex-wrap items-center gap-2 text-sm font-medium">
        <span>
          {label}
          {required && <RequiredMark />}
        </span>
        {missing.length > 0 && missing.length < 3 && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-normal text-amber-700 dark:text-amber-300">
            Chưa dịch: {missing.map((l) => l.toUpperCase()).join(", ")}
          </span>
        )}
      </legend>
      {required && (
        <p className="text-xs text-muted-foreground">EN bắt buộc. JA, VI không bắt buộc: để trống thì trang hiển thị bản EN.</p>
      )}
      <div className="grid gap-2 md:grid-cols-3">
        {LOCALES.map((locale) => {
          const id = `field-${idPrefix}.${locale}`;
          const props = {
            ...a11yProps(id, errors[locale]),
            lang: locale,
            value: value[locale] ?? "",
            className: errors[locale] ? "border-destructive" : undefined,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              onChange({ ...value, [locale]: e.target.value }),
          };
          return (
            <div key={locale} className="flex flex-col gap-1">
              <label htmlFor={id} className="text-xs text-muted-foreground">
                {locale.toUpperCase()}
                {required && locale === "en" && <RequiredMark />}
                <span className="sr-only"> · {label}</span>
              </label>
              {multiline ? <Textarea rows={4} {...props} /> : <Input {...props} />}
              <FieldError id={id} message={errors[locale]} />
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
