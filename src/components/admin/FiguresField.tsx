"use client";

import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import {
  FIGURE_CATEGORIES,
  MAX_FIGURES,
  type DiagramFigure,
  type Figure,
  type FigureCategory,
} from "@/content/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  lazyRenderDiagram,
  readImageSize as readImageSizeDefault,
  uploadImage,
} from "@/lib/admin/figures-client";
import type { RenderFn } from "@/lib/admin/figures-save";
import { UPLOAD_RULES } from "@/lib/admin/upload";
import { FIGURE_KANJI } from "@/lib/figures/categories";
import { MERMAID_THEME_VERSION } from "@/lib/figures/mermaid-theme";
import { cn } from "@/lib/utils";
import { useAdminAccess } from "./AdminAccessProvider";
import { DIAGRAM_TEMPLATES, DiagramEditor } from "./DiagramEditor";
import { FieldError } from "./FieldShell";
import { EMPTY_I18N, I18nField, type I18nValue } from "./I18nField";
import { SortableList } from "./SortableList";

const MediaBrowser = lazy(() =>
  import("./MediaBrowser").then((module) => ({ default: module.MediaBrowser })),
);

const CATEGORY_LABELS: Record<FigureCategory, string> = {
  screen: "Màn hình",
  architecture: "Kiến trúc",
  erd: "ERD",
  flow: "Luồng",
  other: "Khác",
};

type FieldErrorItem = { path: string; message: string };

const i18n = (v: Partial<I18nValue> | undefined): I18nValue => ({
  ...EMPTY_I18N,
  en: v?.en ?? "",
  ja: v?.ja ?? "",
  vi: v?.vi ?? "",
});

function newId(taken: Figure[]): string {
  for (;;) {
    const id = `fig-${Math.random().toString(36).slice(2, 8)}`;
    if (/^fig-[a-z0-9]+$/.test(id) && !taken.some((f) => f.id === id))
      return id;
  }
}

const isDraft = (f: DiagramFigure) => !f.svgLight || !f.svgDark;
const isOutdated = (f: DiagramFigure) =>
  !isDraft(f) && f.themeVersion < MERMAID_THEME_VERSION;

/**
 * A project's figures: a reorderable list (drag, or the Move up / Move down buttons),
 * images picked from or uploaded to the media library, and Mermaid diagrams edited with a
 * live preview. Diagrams are rendered and uploaded when the form saves, not here.
 * The reviewer sees the list and its previews only.
 */
export function FiguresField({
  id,
  name,
  idPrefix,
  label,
  hint,
  value,
  onChange,
  errors,
  projectKind,
  render = lazyRenderDiagram,
  readImageSize = readImageSizeDefault,
}: {
  /** Id of the list as a whole (list-level errors are announced and focused there). */
  id: string;
  /** Form path of the field (error paths start with it). */
  name: string;
  /** Prefix of the input ids: `field-<idPrefix>.<index>.<part>`. */
  idPrefix: string;
  label: string;
  hint?: string;
  value: Figure[];
  onChange: (next: Figure[]) => void;
  errors: FieldErrorItem[];
  projectKind?: string;
  render?: RenderFn;
  readImageSize?: (url: string) => Promise<{ width: number; height: number }>;
}) {
  const { readOnly } = useAdminAccess();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rerenderAll, setRerenderAll] = useState(false);

  const errAt = (path: string) => errors.find((e) => e.path === path)?.message;
  const listError = errAt(name);
  const rowHasError = (i: number) =>
    errors.some(
      (e) => e.path === `${name}.${i}` || e.path.startsWith(`${name}.${i}.`),
    );
  const full = value.length >= MAX_FIGURES;
  const hasDiagram = value.some((f) => f.kind === "diagram");
  const clientWarning =
    projectKind === "work" && value.some((f) => f.kind === "image");

  const update = (i: number, patch: Partial<Figure>) =>
    onChange(
      value.map((f, j) => (j === i ? ({ ...f, ...patch } as Figure) : f)),
    );
  const move = (i: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(i, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  const toggle = (figureId: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(figureId)) next.delete(figureId);
      else next.add(figureId);
      return next;
    });
  const append = (figure: Figure) => {
    onChange([...value, figure]);
    setOpen((prev) => new Set(prev).add(figure.id));
  };

  async function addImage(url: string) {
    setBusy(true);
    try {
      const size = await readImageSize(url);
      append({
        id: newId(value),
        kind: "image",
        category: "screen",
        caption: { ...EMPTY_I18N },
        note: { en: "" },
        alt: { ...EMPTY_I18N },
        url,
        ...size,
      });
      setLibraryOpen(false);
    } catch (error) {
      toast.error(
        `Không thêm được ảnh: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function uploadAndAdd(file: File) {
    setBusy(true);
    try {
      const url = await uploadImage(file);
      setBusy(false);
      await addImage(url);
    } catch (error) {
      toast.error(
        `Tải lên thất bại: ${error instanceof Error ? error.message : String(error)}`,
      );
      setBusy(false);
    }
  }

  function addDiagram() {
    append({
      id: newId(value),
      kind: "diagram",
      category: "architecture",
      caption: { ...EMPTY_I18N },
      note: { en: "" },
      alt: { ...EMPTY_I18N },
      source: DIAGRAM_TEMPLATES[0].source,
      svgLight: "",
      svgDark: "",
      width: 0,
      height: 0,
      renderedAt: "",
      themeVersion: 0,
    });
  }

  function renderRow(figure: Figure, i: number, handle?: React.ReactNode) {
    const n = i + 1;
    const caption = figure.caption.vi?.trim() || figure.caption.en.trim() || "";
    const thumb =
      figure.kind === "image" ? figure.url : figure.svgLight || undefined;
    const hasError = rowHasError(i);
    const expanded = !readOnly && (open.has(figure.id) || hasError);
    const editorId = `${idPrefix}-${i}-editor`;
    return (
      <div className="flex flex-col">
        <div className="flex flex-wrap items-center gap-3 px-2 py-2">
          {handle}
          <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/40">
            {thumb ? (
              // Admin-only thumbnail of an uploaded file; next/image would need the storage host configured.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt={`Hình ${n}`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-[10px] text-muted-foreground">Chưa vẽ</span>
            )}
          </span>
          <span
            aria-hidden
            lang="ja"
            className="text-lg text-muted-foreground"
            title={CATEGORY_LABELS[figure.category]}
          >
            {FIGURE_KANJI[figure.category]}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span
              id={`field-${idPrefix}.${i}`}
              tabIndex={-1}
              data-testid="figure-caption"
              className="truncate text-sm font-medium"
            >
              {caption || "(chưa có chú thích)"}
            </span>
            <span className="text-xs text-muted-foreground">
              {figure.kind === "image" ? "Ảnh" : "Sơ đồ"} ·{" "}
              {CATEGORY_LABELS[figure.category]}
            </span>
          </span>
          {figure.kind === "diagram" && isOutdated(figure) && (
            <span className="rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-xs">
              Cần vẽ lại
            </span>
          )}
          {figure.kind === "diagram" && isDraft(figure) && (
            <span className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
              Vẽ khi lưu
            </span>
          )}
          {hasError && (
            <span className="text-xs font-medium text-destructive">Có lỗi</span>
          )}
          {!readOnly && (
            <span className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Sửa hình ${n}`}
                aria-expanded={expanded}
                aria-controls={expanded ? editorId : undefined}
                onClick={() => toggle(figure.id)}
              >
                Sửa
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Đưa hình ${n} lên`}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                Lên
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Đưa hình ${n} xuống`}
                disabled={i === value.length - 1}
                onClick={() => move(i, i + 1)}
              >
                Xuống
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Xóa hình ${n}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                Xóa
              </Button>
            </span>
          )}
        </div>
        {expanded && (
          <div
            id={editorId}
            className="flex flex-col gap-4 border-t bg-muted/20 px-3 py-3"
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`field-${idPrefix}.${i}.category`}
                className="text-sm font-medium"
              >
                Loại hình
              </label>
              <select
                id={`field-${idPrefix}.${i}.category`}
                className="h-9 w-fit rounded-md border bg-background px-2 text-sm"
                value={figure.category}
                onChange={(e) =>
                  update(i, { category: e.target.value as FigureCategory })
                }
              >
                {FIGURE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {FIGURE_KANJI[c]} {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            {figure.kind === "diagram" ? (
              <DiagramEditor
                idPrefix={`${idPrefix}.${i}`}
                source={figure.source}
                onSourceChange={(source) => update(i, { source })}
                render={render}
                error={errAt(`${name}.${i}.source`)}
                savedPreview={
                  isDraft(figure)
                    ? undefined
                    : { light: figure.svgLight, dark: figure.svgDark }
                }
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Ảnh {figure.width}×{figure.height} px ·{" "}
                <a
                  href={figure.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  mở ảnh
                </a>
              </p>
            )}
            {(["caption", "note", "alt"] as const).map((part) => (
              <I18nField
                key={part}
                label={
                  part === "caption"
                    ? "Chú thích"
                    : part === "note"
                      ? "Ghi chú (không bắt buộc)"
                      : "Mô tả hình (alt)"
                }
                idPrefix={`${idPrefix}.${i}.${part}`}
                required={part !== "note"}
                multiline={part === "alt"}
                value={i18n(figure[part])}
                onChange={(v) => update(i, { [part]: v })}
                errors={{
                  en: errAt(`${name}.${i}.${part}.en`),
                  ja: errAt(`${name}.${i}.${part}.ja`),
                  vi: errAt(`${name}.${i}.${part}.vi`),
                }}
              />
            ))}
            {figure.kind === "diagram" && (
              <p className="text-xs text-muted-foreground">
                Với sơ đồ, mô tả hình nên tóm tắt cấu trúc (các khối và cách
                chúng nối với nhau).
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  const indexOf = new Map(value.map((f, i) => [f.id, i]));

  return (
    <fieldset className="flex flex-col gap-3" data-field={id}>
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      {clientWarning && (
        <p
          role="note"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
        >
          Dự án cho khách hàng: đừng đưa màn hình hoặc dữ liệu của khách lên
          trang. Chỉ dùng ảnh đã được phép công khai hoặc dữ liệu mẫu.
        </p>
      )}
      <div id={id} tabIndex={-1} className="flex flex-col gap-2">
        {value.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có hình nào.</p>
        ) : readOnly ? (
          <ul
            className="flex flex-col divide-y rounded-md border"
            aria-label={label}
          >
            {value.map((f, i) => (
              <li key={f.id}>{renderRow(f, i)}</li>
            ))}
          </ul>
        ) : (
          <SortableList
            label={label}
            items={value}
            onReorder={onChange}
            renderItem={(f, handle) =>
              renderRow(f, indexOf.get(f.id) ?? 0, handle)
            }
          />
        )}
        <FieldError id={id} message={listError} />
      </div>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={full || busy}
              >
                Thêm ảnh
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>Thêm ảnh</DialogTitle>
                <DialogDescription>
                  Tải ảnh mới lên hoặc chọn ảnh đã có trong thư viện. Ảnh chỉ
                  được lưu vào dự án khi bạn lưu form.
                </DialogDescription>
              </DialogHeader>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Tải ảnh mới lên
                <input
                  type="file"
                  accept={UPLOAD_RULES.image.types.join(",")}
                  disabled={busy}
                  className="text-sm font-normal"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void uploadAndAdd(file);
                  }}
                />
              </label>
              {libraryOpen && (
                <Suspense fallback={<p role="status">Đang mở thư viện…</p>}>
                  <MediaBrowser
                    kind="image"
                    onSelect={(url) => void addImage(url)}
                  />
                </Suspense>
              )}
            </DialogContent>
          </Dialog>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={full}
            onClick={addDiagram}
          >
            Thêm sơ đồ
          </Button>
          {hasDiagram && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(
                  value.map((f) =>
                    f.kind === "diagram" ? { ...f, themeVersion: 0 } : f,
                  ),
                );
                setRerenderAll(true);
              }}
            >
              Vẽ lại tất cả sơ đồ
            </Button>
          )}
          {full && (
            <span className="text-xs text-muted-foreground">
              Tối đa {MAX_FIGURES} hình cho mỗi dự án.
            </span>
          )}
          {busy && (
            <span role="status" className="text-xs text-muted-foreground">
              Đang thêm ảnh…
            </span>
          )}
          {rerenderAll && hasDiagram && (
            <span role="status" className={cn("text-xs text-muted-foreground")}>
              Mọi sơ đồ sẽ được vẽ lại khi lưu.
            </span>
          )}
        </div>
      )}
    </fieldset>
  );
}
