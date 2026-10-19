import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ResourceTable } from "@/components/admin/ResourceTable";
import { Button } from "@/components/ui/button";
import { listItems } from "@/lib/admin/data";
import { isResourceKey, resources } from "@/lib/admin/resources";

async function ResourceList({ params }: { params: Promise<{ resource: string }> }) {
  const { resource: key } = await params;
  if (!isResourceKey(key)) notFound();
  const items = await listItems(key);
  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{resources[key].label}</h1>
        <Button asChild>
          <Link href={`/admin/${key}/new`}>Thêm mới</Link>
        </Button>
      </header>
      <p className="text-sm text-muted-foreground">Kéo biểu tượng ⠿ để đổi thứ tự hiển thị trên trang.</p>
      <ResourceTable resourceKey={key} initialItems={items} />
    </>
  );
}

export default function ResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  return (
    <main className="flex flex-col gap-4">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
        <ResourceList params={params} />
      </Suspense>
    </main>
  );
}
