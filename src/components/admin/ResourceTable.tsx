"use client";

import { Copy, Search, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteResource,
  duplicateResource,
  reorderResource,
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
import type { ResourceKey } from "@/lib/admin/resources";
import { tableFor } from "@/lib/admin/versions";
import { cn } from "@/lib/utils";
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
}: {
  resourceKey: ResourceKey;
  initialRows: ListRow[];
  /** What deleting each item takes with it (skill links, why cards, role order). */
  impacts?: Record<string, string[]>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
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

  const filtered = filterRows(rows, { q, status });
  const isFiltered = q.trim() !== "" || status !== "all";

  function run(
    action: () => Promise<ActionResult>,
    done: string,
    undo?: () => void,
    finish?: () => void,
  ) {
    startTransition(async () => {
      const result = await action();
      finish?.();
      if (result.ok) {
        toast.success(done);
      } else {
        undo?.();
        toast.error(result.error);
      }
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
      const result = await duplicateResource(resourceKey, row.id);
      if (result.ok) {
        toast.success(`Đã tạo bản sao ${result.id} (đang ẩn)`);
        router.push(`/admin/${resourceKey}/${result.id}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    const previous = rows;
    setRows(rows.filter((r) => r.id !== target.id));
    track(target.id, "deleted");
    startTransition(async () => {
      const result = await deleteResource(resourceKey, target.id);
      settle(target.id);
      if (!result.ok) {
        setRows(previous);
        toast.error(result.error);
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
    const result = await undoDelete(tableFor(resourceKey), target.id);
    if (result.ok) {
      // Put the row back where it was right away; the refresh then brings the saved data.
      setRows((current) =>
        current.some((r) => r.id === target.id)
          ? current
          : [...current.slice(0, index), target, ...current.slice(index)],
      );
      toast.success(`Đã khôi phục ${target.label}`);
    } else {
      toast.error(result.error);
    }
  }

  const renderRow = (row: ListRow, handle: React.ReactNode) => (
    <div className="flex items-center gap-2 px-2 py-2 text-sm sm:gap-3">
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
      {row.canHide && (
        <Switch
          checked={!row.hidden}
          onCheckedChange={(v) => setPublished(row, v)}
          aria-label={`Hiển thị ${row.label}`}
        />
      )}
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/${resourceKey}/${row.id}`}>Sửa</Link>
      </Button>
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
    </div>
  );

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
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
        {isFiltered
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
      ) : isFiltered ? (
        <ul className="flex flex-col divide-y rounded-md border">
          {filtered.map((row) => (
            <li key={row.id}>{renderRow(row, null)}</li>
          ))}
        </ul>
      ) : (
        <SortableList items={rows} onReorder={reorder} renderItem={renderRow} />
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
