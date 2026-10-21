import { getPreviewContent } from "@/lib/data/preview-content";
export async function PreviewBanner({ locale }: { locale: string }) {
  if (!(await getPreviewContent())) return null;
  return (
    <aside
      aria-label="Chế độ xem trước"
      className="relative z-[60] flex flex-wrap items-center justify-center gap-3 border-b border-amber-500/40 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-950 dark:bg-amber-950 dark:text-amber-100"
    >
      <span>Đang xem trước, có cả mục ẩn</span>
      <form
        action={`/api/preview/exit?locale=${encodeURIComponent(locale)}`}
        method="post"
      >
        <button
          className="rounded px-2 py-1 underline underline-offset-4 focus-visible:outline-2"
          type="submit"
        >
          Thoát xem trước
        </button>
      </form>
    </aside>
  );
}
