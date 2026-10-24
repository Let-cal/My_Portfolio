import type { Metadata } from "next";
import { MediaBrowser } from "@/components/admin/MediaBrowser";

export const metadata: Metadata = { title: "Thư viện media" };

export default function MediaPage() {
  return (
    <main className="min-w-0 space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Thư viện media</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý ảnh, video và PDF đã tải lên. Tệp trong thư mục public của
          website không xuất hiện ở đây.
        </p>
      </header>
      <MediaBrowser />
    </main>
  );
}
