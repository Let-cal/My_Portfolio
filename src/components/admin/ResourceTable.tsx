"use client";
import { TranslationProgress } from "./TranslationProgress";
import { useAdminRouter as useRouter } from "@/lib/admin/use-admin-router";

import { runAction } from "@/lib/admin/action-errors";
import { Copy, Search, Star, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteResource,
  duplicateResource,
  reorderFeatured,
  reorderResource,
  toggleFeatured,
  togglePublished,
  undoDelete,
  type ActionResult,
} from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  filterRows,
  type ListRow,
  type RowStatus,
} from "@/lib/admin/list-view";
import { mergeRows, signature } from "@/lib/admin/sync";
import { FEATURED_LIMIT, starRefusal } from "@/lib/featured";
import type { ResourceKey } from "@/lib/admin/resources";
import { tableFor } from "@/lib/admin/versions";
import { cn } from "@/lib/utils";
import { useAdminAccess } from "./AdminAccessProvider";
import { SortableList } from "./SortableList";

/** The status chips a list offers: show/hide only where items can be hidden, skills only where they link. */
function chipsFor(
  key: ResourceKey,
  rows: ListRow[],
): { status: RowStatus; label: string }[] {
  const canHide = rows.some((r) => r.canHide);
  const linksSkills = rows.some((r) => r.skillCount !== undefined);
  return [
    { status: "all", label: "Tất cả" },
    ...(canHide
      ? [
          { status: "visible" as const, label: "Đang hiện" },
          { status: "hidden" as const, label: "Đang ẩn" },
        ]
      : []),
    { status: "untranslated", label: "Thiếu bản dịch" },
    ...(linksSkills
      ? [
          {
            status: "no-skills" as const,
            label: key === "skills" ? "Chưa có bằng chứng" : "Chưa có skill",
          },
        ]
      : []),
  ];
}

/** Starred rows in their featured order (a star without an order last, then list order). */
function starredRows(rows: ListRow[]): ListRow[] {
  const at = (r: ListRow) => r.featuredOrder ?? Number.POSITIVE_INFINITY;
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.featured)
    .sort((a, b) => at(a.row) - at(b.row) || a.index - b.index)
    .map(({ row }) => row);
}

/** Rows in a given id order (a reorder still saving); rows not in it keep their place at the end. */
function inOrder(rows: ListRow[], ids: string[]): ListRow[] {
  const at = new Map(ids.map((id, i) => [id, i]));
  return [...rows].sort(
    (a, b) => (at.get(a.id) ?? ids.length) - (at.get(b.id) ?? ids.length),
  );
}

export function ResourceTable({
  resourceKey,
  initialRows,
  impacts = {},
  highlightId,
}: {
  resourceKey: ResourceKey;
  initialRows: ListRow[];
  /** What deleting each item takes with it (skill links, why cards, role order). */
  impacts?: Record<string, string[]>;
  /** The item just saved: scrolled into view and marked for a moment. */
  highlightId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // The reviewer reads the list and opens items; no visibility, copy, delete or reorder.
  const { readOnly } = useAdminAccess();
  const [flash, setFlash] = useState<string | null>(highlightId ?? null);
  const [seenHighlight, setSeenHighlight] = useState(highlightId);
  if (highlightId !== seenHighlight) {
    setSeenHighlight(highlightId);
    // The URL drops ?highlight right away; the mark stays until its own timer ends.
    if (highlightId) setFlash(highlightId);
  }
  useEffect(() => {
    if (!highlightId) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    document.getElementById(`row-${highlightId}`)?.scrollIntoView?.({
      block: "center",
      behavior: reduce ? "auto" : "smooth",
    });
    // Drop ?highlight so a reload or Back does not mark it again.
    router.replace(pathname, { scroll: false });
  }, [highlightId, pathname, router]);
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 1800);
    return () => window.clearTimeout(timer);
  }, [flash]);
  const [rows, setRows] = useState(initialRows);
  const undoing = useRef(new Set<string>());
  // Changes this tab is still saving: they win over server data until their action settles.
  const [inflight, setInflight] = useState<
    Map<string, Partial<ListRow> | "deleted">
  >(() => new Map());
  const [inflightOrder, setInflightOrder] = useState<string[] | null>(null);
  // New server data (after any write, here or elsewhere) replaces the rows, pending changes kept.
  const serverSignature = signature(initialRows);
  const [seenSignature, setSeenSignature] = useState(serverSignature);
  if (serverSignature !== seenSignature) {
    setSeenSignature(serverSignature);
    const merged = mergeRows(initialRows, inflight);
    setRows(inflightOrder ? inOrder(merged, inflightOrder) : merged);
  }
  const track = (id: string, change: Partial<ListRow> | "deleted") =>
    setInflight((m) => new Map(m).set(id, change));
  const settle = (id: string) =>
    setInflight((m) => {
      const next = new Map(m);
      next.delete(id);
      return next;
    });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RowStatus>("all");
  const [toDelete, setToDelete] = useState<ListRow | null>(null);
  const [pending, startTransition] = useTransition();
  // Projects: the inline answer to a star the limit refuses, shown under that row.
  const [starRefused, setStarRefused] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const stars = resourceKey === "projects";
  const starred = stars ? starredRows(rows) : [];

  const filtered = filterRows(rows, { q, status });
  const isFiltered = q.trim() !== "" || status !== "all";

  function run(
    action: () => Promise<ActionResult>,
    done: string,
    undo?: () => void,
    finish?: () => void,
    retry?: () => void,
  ) {
    startTransition(async () => {
      const result = await runAction(action, { retry });
      finish?.();
      if (result.ok) toast.success(done);
      else undo?.();
    });
  }

  function reorder(next: ListRow[]) {
    const previous = rows;
    setRows(next);
    setInflightOrder(next.map((r) => r.id));
    run(
      () =>
        reorderResource(
          resourceKey,
          next.map((r) => r.id),
        ),
      "Đã lưu thứ tự",
      () => setRows(previous),
      () => setInflightOrder(null),
      () => reorder(next),
    );
  }

  function setPublished(row: ListRow, value: boolean) {
    setRows(rows.map((r) => (r.id === row.id ? { ...r, hidden: !value } : r)));
    track(row.id, { hidden: !value });
    run(
      () => togglePublished(resourceKey, row.id, value),
      value ? "Đã hiện" : "Đã ẩn",
      () =>
        setRows((current) =>
          current.map((r) => (r.id === row.id ? { ...r, hidden: value } : r)),
        ),
      () => settle(row.id),
      () => setPublished(row, value),
    );
  }

  function toggleStar(row: ListRow) {
    const next = !row.featured;
    if (next) {
      const refusal = starRefusal(
        rows.map((r) => ({ id: r.id, featured: Boolean(r.featured) })),
        row.id,
      );
      if (refusal) {
        setStarRefused({ id: row.id, message: refusal });
        return;
      }
    }
    setStarRefused(null);
    const change = {
      featured: next,
      featuredOrder: next
        ? Math.max(0, ...starred.map((r) => r.featuredOrder ?? 0)) + 1
        : null,
    };
    const before = { featured: row.featured, featuredOrder: row.featuredOrder };
    setRows(rows.map((r) => (r.id === row.id ? { ...r, ...change } : r)));
    track(row.id, change);
    run(
      () => toggleFeatured(row.id),
      next ? `Đã gắn sao ${row.label}` : `Đã bỏ sao ${row.label}`,
      () =>
        setRows((current) =>
          current.map((r) => (r.id === row.id ? { ...r, ...before } : r)),
        ),
      () => settle(row.id),
      () => toggleStar(row),
    );
  }

  function reorderStars(next: ListRow[]) {
    const previous = rows;
    const order = new Map(next.map((r, i) => [r.id, i + 1]));
    setRows(
      rows.map((r) =>
        order.has(r.id) ? { ...r, featuredOrder: order.get(r.id)! } : r,
      ),
    );
    for (const [id, featuredOrder] of order) track(id, { featuredOrder });
    run(
      () => reorderFeatured(next.map((r) => r.id)),
      "Đã lưu thứ tự nổi bật",
      () => setRows(previous),
      () => next.forEach((r) => settle(r.id)),
      () => reorderStars(next),
    );
  }

  function duplicate(row: ListRow) {
    // A copy that cannot start hidden would go public at once: open it as a new, unsaved item.
    if (!row.canHide) {
      router.push(
        `/admin/${resourceKey}/new?from=${encodeURIComponent(row.id)}`,
      );
      return;
    }
    startTransition(async () => {
      const result = await runAction(
        () => duplicateResource(resourceKey, row.id),
        { retry: () => duplicate(row) },
      );
      if (result.ok && "id" in result) {
        toast.success(`Đã tạo bản sao ${result.id} (đang ẩn)`);
        router.push(`/admin/${resourceKey}/${result.id}`);
      }
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    remove(target);
  }

  function remove(target: ListRow) {
    const previous = rows;
    setRows(rows.filter((r) => r.id !== target.id));
    track(target.id, "deleted");
    startTransition(async () => {
      const result = await runAction(
        () => deleteResource(resourceKey, target.id),
        { retry: () => remove(target) },
      );
      settle(target.id);
      if (!result.ok) {
        setRows(previous);
        return;
      }
      // The delete happens at once; for 10 s the toast can bring the item (and its links) back.
      toast.success(`Đã xóa ${target.label}`, {
        duration: 10000,
        action: {
          label: "Hoàn tác",
          onClick: () => void undo(target, previous.indexOf(target)),
        },
      });
    });
  }

  async function undo(target: ListRow, index: number) {
    // The toast button can be clicked again while the first undo is still running.
    if (undoing.current.has(target.id)) return;
    undoing.current.add(target.id);
    const result = await runAction(
      () => undoDelete(tableFor(resourceKey), target.id),
      { retry: () => void undo(target, index) },
    );
    if (result.ok) {
      // Put the row back where it was right away; the refresh then brings the saved data.
      setRows((current) =>
        current.some((r) => r.id === target.id)
          ? current
          : [...current.slice(0, index), target, ...current.slice(index)],
      );
      toast.success(`Đã khôi phục ${target.label}`);
    }
    undoing.current.delete(target.id);
  }

  const renderRow = (row: ListRow, handle: React.ReactNode) => (
    <div
      id={`row-${row.id}`}
      data-highlight={flash === row.id || undefined}
      className="flex flex-wrap items-center gap-2 px-2 py-2 text-sm transition-colors duration-700 data-[highlight=true]:bg-primary/15 sm:gap-3"
    >
      {handle}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-medium",
            row.hidden && "text-muted-foreground",
          )}
        >
          {row.label}
        </p>
        <p className="truncate text-xs text-muted-foreground">{row.detail}</p>
        <TranslationProgress stats={row.translations} />
      </div>
      <div className="hidden flex-wrap justify-end gap-1 md:flex">
        {row.skillCount !== undefined && (
          <Badge
            variant="outline"
            className={cn(
              row.skillCount === 0 &&
                "border-amber-500/50 text-amber-700 dark:text-amber-400",
            )}
          >
            {row.skillCount} {resourceKey === "skills" ? "bằng chứng" : "skill"}
          </Badge>
        )}
        {row.missingLocales.map((l) => (
          <Badge key={l} variant="outline" className="text-muted-foreground">
            Thiếu {l.toUpperCase()}
          </Badge>
        ))}
      </div>
      {stars &&
        (readOnly ? (
          row.featured && (
            <Badge variant="outline" className="gap-1">
              <Star
                aria-hidden
                className="size-3 fill-amber-400 text-amber-500"
              />
              Nổi bật
            </Badge>
          )
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-pressed={Boolean(row.featured)}
            aria-label={`Nổi bật trên trang chủ: ${row.label}`}
            title={
              row.featured
                ? "Bỏ sao"
                : `Gắn sao để hiện trên trang chủ (tối đa ${FEATURED_LIMIT})`
            }
            // One change at a time per item: no second click while the first is saving.
            disabled={inflight.has(row.id)}
            onClick={() => toggleStar(row)}
          >
            <Star
              aria-hidden
              className={cn(
                "size-4",
                row.featured
                  ? "fill-amber-400 text-amber-500"
                  : "text-muted-foreground",
              )}
            />
          </Button>
        ))}
      {row.canHide && !readOnly && (
        <Switch
          checked={!row.hidden}
          // One change at a time per item: no second click while the first is saving.
          disabled={inflight.has(row.id)}
          onCheckedChange={(v) => setPublished(row, v)}
          aria-label={`Hiển thị ${row.label}`}
        />
      )}
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/${resourceKey}/${row.id}`}>
          {readOnly ? "Xem" : "Sửa"}
        </Link>
      </Button>
      {!readOnly && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title="Nhân bản"
            aria-label={`Nhân bản ${row.label}`}
            onClick={() => duplicate(row)}
            disabled={pending}
          >
            <Copy aria-hidden className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            title="Xóa"
            aria-label={`Xóa ${row.label}`}
            onClick={() => setToDelete(row)}
          >
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </>
      )}
      {starRefused?.id === row.id && (
        <p
          role="alert"
          className="basis-full rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300"
        >
          {starRefused.message}
        </p>
      )}
    </div>
  );

  const starredLine = (row: ListRow, i: number, handle: React.ReactNode) => (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
      {handle}
      <span className="w-5 text-right tabular-nums text-muted-foreground">
        {i + 1}.
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{row.label}</span>
      {row.hidden && (
        <Badge variant="outline" className="text-muted-foreground">
          Đang ẩn
        </Badge>
      )}
    </div>
  );
  const featuredStrip = stars && (
    <section
      aria-labelledby="featured-strip-title"
      className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3"
    >
      <h2 id="featured-strip-title" className="text-sm font-semibold">
        Nổi bật trên trang chủ ({starred.length}/{FEATURED_LIMIT})
      </h2>
      <p className="text-xs text-muted-foreground">
        {starred.length === 0
          ? `Chưa gắn sao dự án nào: trang chủ đang hiện ${FEATURED_LIMIT} dự án mới nhất.`
          : starred.length < FEATURED_LIMIT
            ? `Còn ${FEATURED_LIMIT - starred.length} chỗ: trang chủ lấp bằng dự án mới nhất.`
            : readOnly
              ? "Thứ tự trên trang chủ."
              : "Kéo biểu tượng ⠿ (hoặc Space rồi phím mũi tên) để đổi thứ tự trên trang chủ."}
      </p>
      {starred.length > 0 &&
        (readOnly ? (
          <ol
            aria-label="Thứ tự dự án nổi bật"
            className="flex flex-col divide-y rounded-md border bg-background"
          >
            {starred.map((row, i) => (
              <li key={row.id}>{starredLine(row, i, null)}</li>
            ))}
          </ol>
        ) : (
          <SortableList
            label="Thứ tự dự án nổi bật"
            items={starred}
            onReorder={reorderStars}
            renderItem={(row, handle) =>
              starredLine(row, starred.indexOf(row), handle)
            }
          />
        ))}
    </section>
  );

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      {featuredStrip}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên, ID…"
            aria-label="Tìm trong danh sách"
            className="pl-8"
          />
        </div>
        <div
          role="group"
          aria-label="Lọc theo trạng thái"
          className="flex flex-wrap gap-1.5"
        >
          {chipsFor(resourceKey, rows).map((chip) => {
            const count = filterRows(rows, {
              q: "",
              status: chip.status,
            }).length;
            const active = status === chip.status;
            return (
              <button
                key={chip.status}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(chip.status)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {chip.label}{" "}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {readOnly
          ? `${filtered.length}/${rows.length} mục`
          : isFiltered
            ? `${filtered.length}/${rows.length} mục · bỏ lọc để kéo đổi thứ tự`
            : "Kéo biểu tượng ⠿ để đổi thứ tự hiển thị trên trang."}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Chưa có mục nào.
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Không có mục nào khớp bộ lọc.
        </p>
      ) : isFiltered || readOnly ? (
        <ul
          className="flex flex-col divide-y rounded-md border"
          aria-label="Danh sách"
        >
          {filtered.map((row) => (
            <li key={row.id}>{renderRow(row, null)}</li>
          ))}
        </ul>
      ) : (
        <SortableList
          label="Danh sách"
          items={rows}
          onReorder={reorder}
          renderItem={renderRow}
        />
      )}

      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa {toDelete?.label}?</DialogTitle>
            <DialogDescription>
              Mục &quot;{toDelete?.id}&quot; sẽ bị xóa khỏi database và trang
              công khai. Bạn có 10 giây để hoàn tác sau khi xóa.
            </DialogDescription>
            {toDelete && (impacts[toDelete.id]?.length ?? 0) > 0 && (
              <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                  <TriangleAlert aria-hidden className="size-4" />
                  Sẽ bị ảnh hưởng:
                </p>
                <ul className="mt-1 list-disc pl-6">
                  {impacts[toDelete.id].map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Hủy</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDelete}>
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
