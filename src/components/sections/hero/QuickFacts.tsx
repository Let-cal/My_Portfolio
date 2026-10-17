import { useTranslations } from "next-intl";
import { GlowCard } from "@/components/fx/GlowCard";

export type QuickFactsProps = {
  education: { school: string; major: string; gpa?: string | null };
  openToWork: boolean;
  availabilityNote: string;
};

/**
 * Four glow cards under the hero: location, languages, education, now. Each shows a label and a value; hovering
 * or focusing a card opens one more line of detail (always open on touch screens). Only content and messages.
 */
export function QuickFacts({ education, openToWork, availabilityNote }: QuickFactsProps) {
  const t = useTranslations("hero");
  const facts = [
    { id: "location", label: t("facts.location.label"), value: t("facts.location.value"), detail: t("facts.location.detail") },
    { id: "languages", label: t("facts.languages.label"), value: t("facts.languages.value"), detail: t("facts.languages.detail") },
    {
      id: "education",
      label: t("facts.education.label"),
      value: education.school,
      detail: [education.major, education.gpa ? `GPA ${education.gpa}` : ""].filter(Boolean).join(" · "),
    },
    ...(openToWork ? [{ id: "now", label: t("facts.now.label"), value: t("openToWork"), detail: availabilityNote }] : []),
  ];

  return (
    <ul aria-label={t("facts.label")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {facts.map((f) => (
        <li key={f.id} className="flex">
          <GlowCard
            tabIndex={0}
            className="group flex w-full flex-col rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">{f.label}</span>
            <span className="mt-1 font-heading text-lg font-semibold">{f.value}</span>
            <span className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr] motion-reduce:transition-none [@media(hover:none)]:grid-rows-[1fr]">
              <span className="min-h-0 overflow-hidden">
                <span className="block pt-2 text-sm text-muted-foreground">{f.detail}</span>
              </span>
            </span>
          </GlowCard>
        </li>
      ))}
    </ul>
  );
}
