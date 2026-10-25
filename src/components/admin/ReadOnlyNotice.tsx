import { Eye } from "lucide-react";

/** Always on top of the reviewer's admin: what they see is everything, and nothing can change. */
export function ReadOnlyNotice() {
  return (
    <div
      role="status"
      className="-mx-4 flex items-center justify-center gap-2 bg-sky-500/15 px-4 py-1.5 text-sm font-medium text-sky-800 dark:text-sky-200"
    >
      <Eye aria-hidden className="size-4" />
      Chế độ chỉ đọc — bạn có thể xem mọi nội dung nhưng không thể thay đổi.
    </div>
  );
}
