import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-md bg-muted motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/** Placeholder while a list loads: toolbar plus a few rows. */
export function ListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải danh sách"
      className="flex flex-col gap-3"
    >
      <Bar className="h-9 w-64" />
      {Array.from({ length: 6 }, (_, i) => (
        <Bar key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

/** Placeholder while a form loads: label + input pairs. */
export function FormSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải form"
      className="flex flex-col gap-5"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Bar className="h-4 w-32" />
          <Bar className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder for the dashboard: stat cards and a list. */
export function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải tổng quan"
      className="flex flex-col gap-6"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Bar key={i} className="h-24" />
        ))}
      </div>
      <Bar className="h-40 w-full" />
    </div>
  );
}
