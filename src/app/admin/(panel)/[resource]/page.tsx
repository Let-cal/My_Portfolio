import { ListSkeleton } from "@/components/admin/Skeletons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ResourceTable } from "@/components/admin/ResourceTable";
import { SkillMatrix } from "@/components/admin/SkillMatrix";
import { Button } from "@/components/ui/button";
import { getAdminContent } from "@/lib/admin/data";
import { deleteImpact } from "@/lib/admin/impact";
import { listRows } from "@/lib/admin/list-view";
import { parseMatrixFilter } from "@/lib/admin/matrix";
import { isResourceKey, resources } from "@/lib/admin/resources";

type Params = Promise<{ resource: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function ResourceList({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ resource: key }, sp] = await Promise.all([params, searchParams]);
  if (!isResourceKey(key)) notFound();
  const matrix = key === "skills" && sp.view !== "list";
  const content = await getAdminContent();
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{resources[key].label}</h1>
        <div className="flex gap-2">
          {key === "skills" && (
            <Button asChild variant="outline">
              <Link href={matrix ? "/admin/skills?view=list" : "/admin/skills"}>
                {matrix ? "Dạng danh sách" : "Dạng ma trận"}
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href={`/admin/${key}/new`}>Thêm mới</Link>
          </Button>
        </div>
      </header>
      {!content ? (
        <p role="alert" className="rounded-md border p-3 text-sm">
          Chưa có hồ sơ trong database. Chạy npm run db:seed.
        </p>
      ) : matrix ? (
        <SkillMatrix content={content} initialFilter={parseMatrixFilter(sp)} />
      ) : (
        <ResourceTable
          resourceKey={key}
          initialRows={listRows(key, content)}
          highlightId={
            typeof sp.highlight === "string" ? sp.highlight : undefined
          }
          impacts={Object.fromEntries(
            listRows(key, content).map((r) => [
              r.id,
              deleteImpact(key, r.id, content),
            ]),
          )}
        />
      )}
    </>
  );
}

export default function ResourcePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <main className="flex min-w-0 flex-col gap-4">
      <Suspense fallback={<ListSkeleton />}>
        <ResourceList params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
