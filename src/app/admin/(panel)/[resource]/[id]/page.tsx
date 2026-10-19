import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { emptyItem, ResourceForm } from "@/components/admin/ResourceForm";
import { getItem, relationOptions } from "@/lib/admin/data";
import { isResourceKey, resources } from "@/lib/admin/resources";

type Params = Promise<{ resource: string; id: string }>;

async function Editor({ params }: { params: Params }) {
  const { resource: key, id } = await params;
  if (!isResourceKey(key)) notFound();
  const isNew = id === "new";
  const [item, options] = await Promise.all([
    isNew ? Promise.resolve(emptyItem(key)) : getItem(key, id),
    key === "skills" ? relationOptions() : Promise.resolve({ experiences: [], projects: [] }),
  ]);
  if (!item) notFound();
  return (
    <>
      <header className="flex flex-col gap-1">
        <Link href={`/admin/${key}`} className="text-sm text-muted-foreground hover:underline">
          ← {resources[key].label}
        </Link>
        <h1 className="text-2xl font-semibold">{isNew ? "Thêm mới" : `Sửa ${id}`}</h1>
      </header>
      <ResourceForm resourceKey={key} initial={item} isNew={isNew} options={options} />
    </>
  );
}

export default function EditResourcePage({ params }: { params: Params }) {
  return (
    <main className="flex flex-col gap-4">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
        <Editor params={params} />
      </Suspense>
    </main>
  );
}
