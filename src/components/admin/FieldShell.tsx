import { cn } from "@/lib/utils";

/** Props an input needs to announce its own error. */
export function a11yProps(id: string, error?: string) {
  return {
    id,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const;
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-1.5 text-sm font-normal text-destructive">
      <span aria-hidden>⚠</span>
      <p id={`${id}-error`}>{message}</p>
    </div>
  );
}

export function RequiredMark() {
  return (
    <>
      <span aria-hidden className="ml-0.5 text-destructive">
        *
      </span>
      <span className="sr-only"> (bắt buộc)</span>
    </>
  );
}

/**
 * Label, required mark, hint and error around one input. `htmlFor` points at the input with
 * `id`; groups (several inputs) pass `group` and get a fieldset with a legend instead.
 */
export function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  group,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  group?: boolean;
  children: React.ReactNode;
}) {
  const title = (
    <>
      {label}
      {required && <RequiredMark />}
    </>
  );
  const hintEl = hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null;
  if (group) {
    return (
      <fieldset className="flex flex-col gap-2" data-field={id}>
        <legend className="mb-1 text-sm font-medium">{title}</legend>
        {hintEl}
        {children}
        <FieldError id={id} message={error} />
      </fieldset>
    );
  }
  return (
    <div className={cn("flex flex-col gap-1.5")} data-field={id}>
      <label htmlFor={id} className="text-sm font-medium">
        {title}
      </label>
      {hintEl}
      {children}
      <FieldError id={id} message={error} />
    </div>
  );
}
