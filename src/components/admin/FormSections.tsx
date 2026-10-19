"use client";

import { focusField } from "./ErrorSummary";

export type FormSection = { id: string; title: string; fields: string[] };

/** Sticky table of contents for long forms, with an error count per section. */
export function FormSectionNav({ sections, errorsByField }: { sections: FormSection[]; errorsByField: Map<string, number> }) {
  return (
    <nav aria-label="Các mục của form" className="top-4 hidden self-start lg:sticky lg:block">
      <ul className="flex flex-col gap-0.5 border-l text-sm">
        {sections.map((s) => {
          const count = s.fields.reduce((n, f) => n + (errorsByField.get(f) ?? 0), 0);
          return (
            <li key={s.id}>
              <a
                href={`#section-${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="-ml-px flex items-center justify-between gap-2 border-l-2 border-transparent py-1 pr-2 pl-3 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              >
                {s.title}
                {count > 0 && (
                  <span className="rounded-full bg-destructive/15 px-1.5 text-xs font-medium text-destructive" aria-label={`${count} lỗi`}>
                    {count}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function FormSectionBlock({ section, children }: { section: FormSection; children: React.ReactNode }) {
  return (
    <section id={`section-${section.id}`} aria-labelledby={`section-${section.id}-title`} className="flex scroll-mt-6 flex-col gap-5 rounded-lg border p-4">
      <h2 id={`section-${section.id}-title`} className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {section.title}
      </h2>
      {children}
    </section>
  );
}

export { focusField };
