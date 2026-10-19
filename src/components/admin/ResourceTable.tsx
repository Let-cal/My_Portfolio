"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteResource, reorderResource, togglePublished, type ActionResult } from "@/app/admin/actions";
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
import { Switch } from "@/components/ui/switch";
import type { Item } from "@/lib/admin/data";
import { resources, type ResourceKey } from "@/lib/admin/resources";
import { SortableList } from "./SortableList";

function cell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object" && "en" in (value as object)) return String((value as { en: string }).en);
  return String(value);
}

export function ResourceTable({ resourceKey, initialItems }: { resourceKey: ResourceKey; initialItems: Item[] }) {
  const resource = resources[resourceKey];
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [toDelete, setToDelete] = useState<Item | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>, done: string, undo?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(done);
        router.refresh();
      } else {
        undo?.();
        toast.error(result.error);
      }
    });
  }

  function reorder(next: Item[]) {
    const previous = items;
    setItems(next);
    run(() => reorderResource(resourceKey, next.map((i) => i.id)), "Đã lưu thứ tự", () => setItems(previous));
  }

  function setPublished(item: Item, value: boolean) {
    const previous = items;
    setItems(items.map((i) => (i.id === item.id ? { ...i, published: value } : i)));
    run(() => togglePublished(resourceKey, item.id, value), value ? "Đã hiện" : "Đã ẩn", () => setItems(previous));
  }

  function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    const previous = items;
    setItems(items.filter((i) => i.id !== target.id));
    run(() => deleteResource(resourceKey, target.id), `Đã xóa ${target.id}`, () => setItems(previous));
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Chưa có mục nào.</p>
      ) : (
        <SortableList
          items={items}
          onReorder={reorder}
          renderItem={(item, handle) => (
            <div className="flex items-center gap-3 px-2 py-2 text-sm">
              {handle}
              <div className="grid flex-1 gap-x-4 sm:grid-cols-3">
                {resource.listColumns.map((col) => (
                  <span key={col} className="truncate first:font-medium">
                    {cell(item[col])}
                  </span>
                ))}
              </div>
              {resource.hasPublished && (
                <Switch
                  checked={Boolean(item.published)}
                  onCheckedChange={(v) => setPublished(item, v)}
                  aria-label={`Hiển thị ${item.id}`}
                />
              )}
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/${resourceKey}/${item.id}`}>Sửa</Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setToDelete(item)}>
                Xóa
              </Button>
            </div>
          )}
        />
      )}

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa {toDelete?.id}?</DialogTitle>
            <DialogDescription>Mục này sẽ bị xóa khỏi database và trang công khai. Không thể hoàn tác.</DialogDescription>
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
