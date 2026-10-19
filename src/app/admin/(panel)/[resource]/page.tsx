import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ResourceTable } from "@/components/admin/ResourceTable";
import { SkillMatrix } from "@/components/admin/SkillMatrix";
import { Button } from "@/components/ui/button";
import { getAdminContent, listItems } from "@/lib/admin/data";
import { parseMatrixFilter } from "@/lib/admin/matrix";
import { isResourceKey, resources } from "@/lib/admin/resources";

type Params = Promise<{ resource: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function ResourceList({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ resource: key }, sp] = await Promise.all([params, searchParams]);
  if (!isResourceKey(key)) notFound();
  const matrix = key === "skills" && sp.view !== "list";
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{resources[key].label}</h1>
        <div className="flex gap-2">
          {key === "skills" && (
            <Button asChild variant="outline">
              <Link href={matrix ? "/admin/skills?view=list" : "/admin/skills"}>{matrix ? "Dạng danh sách" : "Dạng ma trận"}</Link>
            </Button>
          )}
          <Button asChild>
            <Link href={`/admin/${key}/new`}>Thêm mới</Link>
          </Button>
        </div>
      </header>
      {matrix ? (
        <SkillMatrix content={await getAdminContent()} initialFilter={parseMatrixFilter(sp)} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Kéo biểu tượng ⠿ để đổi thứ tự hiển thị trên trang.</p>
          <ResourceTable resourceKey={key} initialItems={await listItems(key)} />
        </>
      )}
    </>
  );
}

export default function ResourcePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <main className="flex min-w-0 flex-col gap-4">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
        <ResourceList params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
