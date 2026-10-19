"use client";

import { Button } from "@/components/ui/button";

/** Keeps the admin navigation usable when one page fails to load (e.g. a database hiccup). */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-red-500/40 p-4">
      <h1 className="text-lg font-semibold">Không tải được trang này</h1>
      <p className="text-sm text-muted-foreground">{error.message || "Lỗi không rõ."}</p>
      <Button variant="outline" onClick={reset}>
        Thử lại
      </Button>
    </main>
  );
}
