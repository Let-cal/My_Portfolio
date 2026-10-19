import { getAdminContent } from "@/lib/admin/data";
import { checkContentHealth, type AdminContent } from "@/lib/admin/health";

/**
 * Count of errors and warnings next to "Tổng quan". It is decoration: when content cannot be
 * loaded it renders nothing instead of failing every admin page that shares the layout.
 */
export async function HealthBadge({ load = getAdminContent }: { load?: () => Promise<AdminContent | null> } = {}) {
  let count = 0;
  try {
    const content = await load();
    if (!content) return null;
    count = checkContentHealth(content).filter((i) => i.severity !== "info").length;
  } catch {
    return null;
  }
  if (!count) return null;
  return (
    <span className="ml-auto rounded-full bg-amber-500/20 px-1.5 text-xs font-medium tabular-nums" aria-label={`${count} mục cần chú ý`}>
      {count}
    </span>
  );
}
