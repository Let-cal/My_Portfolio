"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { describeRenderError, type RenderFn } from "@/lib/admin/figures-save";
import type { DiagramTheme } from "@/lib/figures/mermaid-theme";
import { cn } from "@/lib/utils";
import { a11yProps, FieldError, RequiredMark } from "./FieldShell";

/** Starting points from the spec: architecture, ERD, flow and sequence. */
export const DIAGRAM_TEMPLATES = [
  {
    id: "architecture",
    label: "Kiến trúc (flowchart LR)",
    source:
      "flowchart LR\n  client[Client] --> api[API]\n  api --> db[(Database)]",
  },
  {
    id: "erd",
    label: "ERD (erDiagram)",
    source:
      "erDiagram\n  USER ||--o{ ORDER : places\n  ORDER ||--|{ LINE_ITEM : contains",
  },
  {
    id: "flow",
    label: "Luồng (flowchart TD)",
    source:
      "flowchart TD\n  start([Start]) --> step[Step]\n  step --> done([Done])",
  },
  {
    id: "sequence",
    label: "Trình tự (sequenceDiagram)",
    source:
      "sequenceDiagram\n  Client->>API: Request\n  API-->>Client: Response",
  },
] as const;

/** Preview delay after the last keystroke. */
export const PREVIEW_DELAY_MS = 400;

const toDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/**
 * Mermaid source on the left, live preview on the right. The preview renders with the
 * site theme 400 ms after typing stops; on a syntax error the parser message shows under
 * the source and the last good preview stays, dimmed.
 */
export function DiagramEditor({
  idPrefix,
  source,
  onSourceChange,
  render,
  error,
  savedPreview,
}: {
  /** The source textarea gets the id `field-<idPrefix>.source`. */
  idPrefix: string;
  source: string;
  onSourceChange: (source: string) => void;
  render: RenderFn;
  error?: string;
  /** Stored renderings, shown until the first preview is ready. */
  savedPreview?: Partial<Record<DiagramTheme, string>>;
}) {
  const sourceId = `field-${idPrefix}.source`;
  const [theme, setTheme] = useState<DiagramTheme>("light");
  const [preview, setPreview] = useState<{
    src: string;
    theme: DiagramTheme;
  } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The renderer may be a new function on each parent render; only source and theme
  // changes should start a render.
  const renderRef = useRef(render);
  useEffect(() => {
    renderRef.current = render;
  }, [render]);
  const lastSource = useRef<string | null>(null);

  useEffect(() => {
    const typed = lastSource.current !== null && lastSource.current !== source;
    lastSource.current = source;
    if (!source.trim()) return;
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        setBusy(true);
        renderRef.current(source, theme).then(
          (result) => {
            if (cancelled) return;
            setPreview({ src: toDataUrl(result.svg), theme });
            setProblem(null);
            setBusy(false);
          },
          (reason: unknown) => {
            if (cancelled) return;
            setProblem(describeRenderError(reason));
            setBusy(false);
          },
        );
      },
      typed ? PREVIEW_DELAY_MS : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [source, theme]);

  const shown = preview?.src ?? savedPreview?.[theme];
  const stale =
    Boolean(problem) || (preview !== null && preview.theme !== theme);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={sourceId} className="text-sm font-medium">
            Mã Mermaid
            <RequiredMark />
          </label>
          <select
            aria-label="Chèn mẫu sơ đồ"
            className="h-8 rounded-md border bg-background px-2 text-xs"
            value=""
            onChange={(e) => {
              const template = DIAGRAM_TEMPLATES.find(
                (t) => t.id === e.target.value,
              );
              if (template) onSourceChange(template.source);
            }}
          >
            <option value="">Chèn mẫu…</option>
            {DIAGRAM_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <Textarea
          {...a11yProps(sourceId, error)}
          aria-describedby={
            [
              error ? `${sourceId}-error` : "",
              problem ? `${sourceId}-render` : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={cn(
            "min-h-48 font-mono text-xs leading-relaxed",
            error && "border-destructive",
          )}
          spellCheck={false}
          value={source}
          onChange={(e) => onSourceChange(e.target.value)}
        />
        <FieldError id={sourceId} message={error} />
        {problem && (
          <div
            role="alert"
            id={`${sourceId}-render`}
            className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive"
          >
            <p className="font-medium">Chưa vẽ được bản xem trước:</p>
            <pre className="mt-1 overflow-x-auto font-mono whitespace-pre-wrap">
              {problem}
            </pre>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Xem trước</span>
          <span className="flex gap-1" role="group" aria-label="Nền xem trước">
            {(["light", "dark"] as const).map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={theme === t ? "secondary" : "ghost"}
                aria-pressed={theme === t}
                onClick={() => setTheme(t)}
              >
                {t === "light" ? "Sáng" : "Tối"}
              </Button>
            ))}
          </span>
        </div>
        <div
          className={cn(
            "flex min-h-48 items-center justify-center overflow-auto rounded-md border p-3",
            theme === "dark" ? "bg-[#0a0a0b]" : "bg-white",
          )}
          aria-busy={busy}
        >
          {shown ? (
            // A data: or storage URL rendered as an image: an SVG in <img> runs no script.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              data-testid="diagram-preview"
              data-stale={stale ? "true" : "false"}
              src={shown}
              alt="Xem trước sơ đồ"
              className={cn(
                "max-h-96 max-w-full transition-opacity",
                stale && "opacity-40",
              )}
            />
          ) : (
            <span className="text-xs text-muted-foreground">
              {busy ? "Đang vẽ…" : "Chưa có bản xem trước"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
