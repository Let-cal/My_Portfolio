import { translationStats } from "@/lib/admin/health";
export function TranslationProgress({
  value,
  stats,
}: {
  value?: unknown;
  stats?: ReturnType<typeof translationStats>;
}) {
  const counts = stats ?? translationStats(value);
  if (!counts.total) return null;
  return (
    <div
      className="flex flex-wrap gap-2 text-[11px] text-muted-foreground"
      aria-label="Tiến độ bản dịch"
    >
      {(["en", "ja", "vi"] as const).map((locale) => {
        const count = locale === "en" ? counts.total : counts[locale],
          label = `${locale.toUpperCase()} ${count}/${counts.total}`;
        return (
          <span
            key={locale}
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={counts.total}
            aria-valuenow={count}
            className="inline-flex items-center gap-1.5"
          >
            <span>{label}</span>
            <span
              aria-hidden
              className="h-1 w-8 overflow-hidden rounded-full bg-muted"
            >
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${(count / counts.total) * 100}%` }}
              />
            </span>
          </span>
        );
      })}
    </div>
  );
}
