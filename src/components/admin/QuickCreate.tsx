"use client";

import { Award, Briefcase, FolderPlus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useAdminAccess } from "./AdminAccessProvider";

const ITEMS = [
  { href: "/admin/projects/new", label: "Dự án", Icon: FolderPlus },
  { href: "/admin/experiences/new", label: "Kinh nghiệm", Icon: Briefcase },
  { href: "/admin/certificates/new", label: "Chứng chỉ", Icon: Award },
  { href: "/admin/skills/new", label: "Kỹ năng", Icon: Sparkles },
];

/** One-click creates for the items added most often (not for the read-only reviewer). */
export function QuickCreate() {
  const { readOnly } = useAdminAccess();
  if (readOnly) return null;
  return (
    <nav aria-label="Tạo nhanh" className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Tạo nhanh:</span>
      {ITEMS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Icon aria-hidden className="size-4 text-muted-foreground" />+ {label}
        </Link>
      ))}
    </nav>
  );
}
