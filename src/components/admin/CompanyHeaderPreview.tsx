import type { Content } from "@/content/schema";
import { buildJourney } from "@/lib/journey";

/**
 * How each company's header will look in the Experience tree: its name, span and one line per position
 * (stint), built with the same `buildJourney` as the site. English, published positions only.
 */
export function CompanyHeaderPreview({ content }: { content: Content }) {
  const companies = buildJourney(content, "en", (key) => key).filter(
    (p) => p.kind === "company",
  );
  return (
    <section
      aria-labelledby="company-preview-title"
      className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3"
    >
      <h2 id="company-preview-title" className="text-sm font-semibold">
        Xem trước trên cây kinh nghiệm
      </h2>
      <p className="text-xs text-muted-foreground">
        Tiêu đề công ty như khách thấy (bản EN). Các vị trí cùng công ty mẹ gộp
        thành một công ty; vị trí đang ẩn không hiện.
      </p>
      {companies.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có vị trí nào đang hiện.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {companies.map((company) => (
            <li
              key={company.key}
              aria-labelledby={`preview-${company.anchor}`}
              className="flex flex-col gap-1 rounded-md border bg-background p-3 text-sm"
            >
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span
                  id={`preview-${company.anchor}`}
                  className="font-semibold"
                >
                  {company.name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {company.period}
                </span>
              </p>
              {company.location && (
                <p className="text-xs text-muted-foreground">
                  {company.location}
                </p>
              )}
              <ul className="mt-1 flex flex-col gap-0.5 border-l-2 pl-2">
                {company.lines.map((line) => (
                  <li
                    key={`${line.title}-${line.period}`}
                    className="flex flex-wrap justify-between gap-x-3"
                  >
                    <span>{line.title}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {line.period}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
