"use client";

import { Button } from "@/components/ui/button";

/** Keeps the admin navigation usable when one page fails to load (e.g. a database hiccup). */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-red-500/40 p-4"
    >
      <h1 className="text-lg font-semibold">Không tải được trang này</h1>
      <p className="text-sm text-muted-foreground">
        Có lỗi phía server khi tải dữ liệu. Thử lại; nếu vẫn lỗi, gửi mã bên
        dưới để tra log.
      </p>
      {error.digest && (
        <code className="rounded bg-muted px-2 py-1 text-xs">
          Mã lỗi: {error.digest}
        </code>
      )}
      <Button variant="outline" onClick={reset}>
        Thử lại
      </Button>
    </main>
  );
}
