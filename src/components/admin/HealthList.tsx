import Link from "next/link";
import type { HealthIssue } from "@/lib/admin/health";
import { cn } from "@/lib/utils";

const RANK = { error: 0, warning: 1, info: 2 } as const;
const CHIP: Record<HealthIssue["severity"], { label: string; className: string }> = {
  error: { label: "Lỗi", className: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300" },
  warning: { label: "Cần sửa", className: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300" },
  info: { label: "Thông tin", className: "border-sky-500/50 bg-sky-500/10 text-sky-800 dark:text-sky-300" },
};

/** "Cần chú ý": each issue links to the screen where it is fixed, most severe first. */
export function HealthList({ issues }: { issues: HealthIssue[] }) {
  if (issues.length === 0) {
    return <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">Mọi thứ ổn ✓ Không có nội dung nào cần sửa.</p>;
  }
  const sorted = [...issues].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {sorted.map((issue) => (
        <li key={issue.id}>
          <Link href={issue.href} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted">
            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium", CHIP[issue.severity].className)}>
              {CHIP[issue.severity].label}
            </span>
            <span className="flex-1">{issue.message}</span>
            <span aria-hidden className="text-muted-foreground">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
