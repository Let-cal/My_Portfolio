"use client";

import { runAction } from "@/lib/admin/action-errors";
import { History, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { listVersions, restoreVersion } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ADMIN_DISCARD_EVENT } from "@/lib/admin/sync";
import { diffRow, type Version } from "@/lib/admin/versions";
import { cn } from "@/lib/utils";
import { confirmLeave } from "./SaveBar";

type Loaded = { versions: Version[]; current: Record<string, unknown> | null };

function ago(iso: string): string {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  if (Math.abs(minutes) < 60 * 24)
    return rtf.format(Math.round(minutes / 60), "hour");
  return rtf.format(Math.round(minutes / 1440), "day");
}

/**
 * "Lịch sử": every saved version of one item, what each changed compared with now, and a way
 * back. A restore is itself saved as a version, so it can be undone the same way.
 */
export function VersionHistory({
  table,
  itemKey,
}: {
  table: string;
  itemKey: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Version | null>(null);
  const [loading, startLoading] = useTransition();
  const [restoring, startRestoring] = useTransition();

  function load() {
    setError(null);
    setSelected(null);
    startLoading(async () => {
      const result = await runAction(() => listVersions(table, itemKey), {
        silent: true,
      });
      if (result.ok && "versions" in result)
        setData({ versions: result.versions, current: result.current });
      else if (!result.ok) setError(result.error);
    });
  }

  function restore(version: Version) {
    if (!confirmLeave()) return;
    startRestoring(async () => {
      const result = await runAction(() => restoreVersion(version.id), {
        retry: () => restore(version),
      });
      if (!result.ok) return;
      // Open forms drop their edits (already confirmed) and take the restored data that the
      // action's refresh brings; the history list reloads for the next restore.
      window.dispatchEvent(new Event(ADMIN_DISCARD_EVENT));
      toast.success("Đã khôi phục phiên bản");
      setOpen(false);
    });
  }

  const lines = selected && data ? diffRow(selected.oldRow, data.current) : [];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => {
          setOpen(true);
          load();
        }}
      >
        <History aria-hidden className="size-4" />
        Lịch sử
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle>Lịch sử thay đổi</SheetTitle>
            <SheetDescription>
              Mỗi lần lưu hoặc xóa giữ lại bản trước đó (tối đa 50 bản). Chọn
              một bản để xem khác gì so với hiện tại.
            </SheetDescription>
          </SheetHeader>
          <div
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
            aria-busy={loading}
          >
            {error ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/50 p-3 text-sm text-destructive"
              >
                Không tải được lịch sử: {error}
              </p>
            ) : loading || !data ? (
              <div className="flex flex-col gap-2" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-md bg-muted"
                  />
                ))}
              </div>
            ) : data.versions.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Chưa có phiên bản nào. Mỗi lần lưu sẽ tạo một phiên bản để khôi
                phục.
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-1.5">
                  {data.versions.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        aria-pressed={selected?.id === v.id}
                        onClick={() => setSelected(v)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          selected?.id === v.id
                            ? "border-primary bg-primary/10"
                            : "hover:bg-muted",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-xs font-medium",
                              v.op === "delete"
                                ? "bg-destructive/15 text-destructive"
                                : "bg-sky-500/15 text-sky-700 dark:text-sky-300",
                            )}
                          >
                            {v.op === "delete" ? "Xóa" : "Sửa"}
                          </span>
                          {ago(v.changedAt)}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {v.changedBy ?? "hệ thống"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {selected && (
                  <section
                    className="flex flex-col gap-3"
                    aria-label="Khác biệt so với hiện tại"
                  >
                    {lines.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Bản này giống hệt nội dung hiện tại.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/60 text-xs text-muted-foreground">
                            <tr>
                              <th
                                scope="col"
                                className="p-2 text-left font-medium"
                              >
                                Trường
                              </th>
                              <th
                                scope="col"
                                className="p-2 text-left font-medium"
                              >
                                Bản này
                              </th>
                              <th
                                scope="col"
                                className="p-2 text-left font-medium"
                              >
                                Hiện tại
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {lines.map((l) => (
                              <tr key={l.field} className="border-t align-top">
                                <th
                                  scope="row"
                                  className="p-2 text-left font-mono text-xs font-normal"
                                >
                                  {l.field}
                                </th>
                                <td className="p-2 break-words whitespace-pre-line text-rose-700 dark:text-rose-300">
                                  {l.before}
                                </td>
                                <td className="p-2 break-words whitespace-pre-line text-emerald-700 dark:text-emerald-300">
                                  {l.after}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <Button
                      type="button"
                      className="gap-1.5 self-start"
                      disabled={restoring || lines.length === 0}
                      onClick={() => restore(selected)}
                    >
                      <RotateCcw aria-hidden className="size-4" />
                      {restoring ? "Đang khôi phục…" : "Khôi phục bản này"}
                    </Button>
                  </section>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
