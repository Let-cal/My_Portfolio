"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { CommandItem as Item } from "@/lib/admin/command-items";
import { confirmLeave } from "./SaveBar";

/** ⌘/Ctrl+K palette: jump to any screen or item, create, or open the public site. */
export function AdminCommand({ items }: { items: Item[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const groups = [...new Set(items.map((i) => i.group))];
  const go = (href: string) => {
    setOpen(false);
    if (href.startsWith("/admin")) {
      if (confirmLeave()) router.push(href);
    } else window.open(href, "_blank", "noopener");
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
        aria-label="Tìm hoặc nhảy tới (Ctrl/⌘+K)"
      >
        <Search aria-hidden className="size-4" />
        <span className="hidden sm:inline">Tìm…</span>
        <kbd className="hidden rounded border px-1 text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Tìm trong admin"
        description="Nhảy tới màn hình, mục nội dung hoặc tạo mới"
      >
        <Command label="Tìm trong admin">
          <CommandInput placeholder="Gõ tên dự án, chứng chỉ, skill…" />
          <CommandList>
            <CommandEmpty>Không tìm thấy.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group} heading={group}>
                {items
                  .filter((i) => i.group === group)
                  .map((i) => (
                    <CommandItem
                      key={i.href + i.label}
                      value={`${i.label} ${i.keywords}`}
                      onSelect={() => go(i.href)}
                    >
                      {i.label}
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
