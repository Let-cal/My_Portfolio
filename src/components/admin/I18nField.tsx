"use client";

import { rovingKey } from "./roving";
import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { a11yProps, FieldError, RequiredMark } from "./FieldShell";

export type I18nValue = { en: string; ja: string; vi: string };
export type I18nErrors = Partial<Record<keyof I18nValue, string>>;
type Locale = keyof I18nValue;
export type LocaleMode = "all" | Locale;
const LOCALES = ["en", "ja", "vi"] as const;
export const EMPTY_I18N: I18nValue = { en: "", ja: "", vi: "" };
const STORAGE_KEY = "admin.locales";

const ModeContext = createContext<{
  mode: LocaleMode;
  setMode: (m: LocaleMode) => void;
}>({
  mode: "all",
  setMode: () => {},
});

const MODES = new Set<string>(["all", "en", "ja", "vi"]);
const listeners = new Set<() => void>();
function readStoredMode(): LocaleMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && MODES.has(saved) ? (saved as LocaleMode) : "all";
  } catch {
    return "all"; // Storage can be unavailable (private mode).
  }
}
function storeMode(m: LocaleMode) {
  try {
    localStorage.setItem(STORAGE_KEY, m);
  } catch {
    // Not remembered this time.
  }
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Which languages the translated fields show; remembered in this browser. The server always
 * renders "Cả 3", the browser then switches to the remembered choice without a hydration mismatch.
 */
export function LocaleModeProvider({
  initialMode,
  children,
}: {
  initialMode?: LocaleMode;
  children: React.ReactNode;
}) {
  const stored = useSyncExternalStore(
    subscribe,
    readStoredMode,
    () => "all" as LocaleMode,
  );
  const [fixed, setFixed] = useState<LocaleMode | undefined>(initialMode);
  const mode = fixed ?? stored;
  const setMode = (m: LocaleMode) => {
    if (fixed !== undefined) setFixed(m);
    storeMode(m);
  };
  return <ModeContext value={{ mode, setMode }}>{children}</ModeContext>;
}

/** "Cả 3 · EN · JA · VI" switch; a red dot marks a hidden language that has an error. */
export function LocaleModeSwitch({
  errorLocales = new Set<string>(),
}: {
  errorLocales?: ReadonlySet<string>;
}) {
  const { mode, setMode } = useContext(ModeContext);
  const options: { value: LocaleMode; label: string }[] = [
    { value: "all", label: "Cả 3" },
    { value: "en", label: "EN" },
    { value: "ja", label: "JA" },
    { value: "vi", label: "VI" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Ngôn ngữ đang sửa"
      className="inline-flex rounded-md border p-0.5 text-xs"
    >
      {options.map((o) => {
        const flagged =
          o.value !== "all" && o.value !== mode && errorLocales.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={mode === o.value}
            tabIndex={mode === o.value ? 0 : -1}
            onClick={() => setMode(o.value)}
            onKeyDown={(e) =>
              rovingKey(
                e,
                options.map((x) => x.value),
                mode,
                setMode,
              )
            }
            className={cn(
              "relative rounded px-2.5 py-1 font-medium transition-colors",
              mode === o.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {o.label}
            {flagged && (
              <span
                role="img"
                aria-label={`${o.label} có lỗi`}
                className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One text in three languages. Each language box has its own id (`field-<idPrefix>.<locale>`)
 * and error, so the error summary can jump straight to it. EN is the required one; JA and VI
 * fall back to EN on the public site. In single-language mode the EN text is shown as reference.
 */
export function I18nField({
  label,
  value,
  onChange,
  multiline,
  idPrefix,
  required,
  errors = {},
  onRemove,
}: {
  label: string;
  value: I18nValue;
  onChange: (value: I18nValue) => void;
  multiline?: boolean;
  /** Input ids become `field-<idPrefix>.<locale>`. */
  idPrefix: string;
  required?: boolean;
  errors?: I18nErrors;
  /** For an optional text: "Bỏ" clears it back to "not set". */
  onRemove?: () => void;
}) {
  const { mode } = useContext(ModeContext);
  const shown = mode === "all" ? LOCALES : [mode];
  // A hidden language with an error is shown, and stays shown while it is being fixed (until
  // the mode changes), so the box does not vanish after the first keystroke.
  const [revealed, setRevealed] = useState<{
    mode: LocaleMode;
    locales: Locale[];
  }>({ mode, locales: [] });
  const erroring = LOCALES.filter((l) => errors[l]);
  if (revealed.mode !== mode) {
    setRevealed({ mode, locales: erroring });
  } else if (erroring.some((l) => !revealed.locales.includes(l))) {
    setRevealed({
      mode,
      locales: [...new Set([...revealed.locales, ...erroring])],
    });
  }
  const visible = LOCALES.filter(
    (l) =>
      shown.includes(l) ||
      errors[l] ||
      (revealed.mode === mode && revealed.locales.includes(l)),
  );
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
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-xs font-normal text-muted-foreground"
            aria-label={`Bỏ ${label}`}
            onClick={onRemove}
          >
            Bỏ
          </Button>
        )}
      </legend>
      {required && (
        <p className="text-xs text-muted-foreground">
          EN bắt buộc. JA, VI không bắt buộc: để trống thì trang hiển thị bản
          EN.
        </p>
      )}
      {mode !== "all" && mode !== "en" && value.en && (
        <p className="rounded-md bg-muted/60 px-3 py-2 text-sm whitespace-pre-line text-muted-foreground">
          <span className="mr-1 text-xs font-semibold">EN:</span>
          {value.en}
        </p>
      )}
      <div
        className={cn("grid gap-3", visible.length === 3 && "md:grid-cols-3")}
      >
        {visible.map((locale) => {
          const id = `field-${idPrefix}.${locale}`;
          const props = {
            ...a11yProps(id, errors[locale]),
            lang: locale,
            value: value[locale] ?? "",
            className: cn(
              multiline && "field-sizing-content min-h-20",
              errors[locale] && "border-destructive",
            ),
            onChange: (
              e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
            ) => onChange({ ...value, [locale]: e.target.value }),
          };
          const canCopy =
            locale !== "en" && !value[locale]?.trim() && value.en.trim();
          return (
            <div key={locale} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={id} className="text-xs text-muted-foreground">
                  {locale.toUpperCase()}
                  {required && locale === "en" && <RequiredMark />}
                  <span className="sr-only"> · {label}</span>
                </label>
                {canCopy && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label={`Chép từ EN sang ${locale.toUpperCase()}`}
                    onClick={() => onChange({ ...value, [locale]: value.en })}
                  >
                    Chép từ EN
                  </Button>
                )}
              </div>
              {multiline ? (
                <Textarea rows={3} {...props} />
              ) : (
                <Input {...props} />
              )}
              <FieldError id={id} message={errors[locale]} />
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
