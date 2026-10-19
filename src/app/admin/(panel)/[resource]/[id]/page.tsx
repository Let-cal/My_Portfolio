import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { emptyItem } from "@/lib/admin/empty-item";
import type { Options } from "@/components/admin/ResourceForm";
import type { Skill } from "@/content/schema";
import { getItem, listItems, relationOptions } from "@/lib/admin/data";
import { isResourceKey, resources } from "@/lib/admin/resources";

type Params = Promise<{ resource: string; id: string }>;

async function Editor({ params }: { params: Params }) {
  const { resource: key, id } = await params;
  if (!isResourceKey(key)) notFound();
  const isNew = id === "new";
  const needsSkills = key === "experiences" || key === "projects" || key === "certificates" || key === "activities";
  const [found, relations, skills] = await Promise.all([
    isNew ? Promise.resolve(emptyItem(key)) : getItem(key, id),
    key === "skills" ? relationOptions() : Promise.resolve({ experiences: [], projects: [] }),
    needsSkills ? (listItems("skills") as unknown as Promise<Skill[]>) : Promise.resolve([] as Skill[]),
  ]);
  if (!found) notFound();
  const [ownList, experiences, projects] = await Promise.all([
    listItems(key),
    key === "why_cards" ? listItems("experiences") : Promise.resolve([]),
    key === "why_cards" ? listItems("projects") : Promise.resolve([]),
  ]);
  const hiddenMark = (item: Record<string, unknown>) => (item.published === false ? " (đang ẩn)" : "");
  const options: Options = {
    ...relations,
    existingIds: ownList.map((i) => i.id),
    evidence: {
      experiences: experiences.map((e) => ({ id: e.id, label: `${String(e.company)} · ${String(e.start)}${hiddenMark(e)}` })),
      projects: projects.map((p) => ({ id: p.id, label: `${String(p.title)}${hiddenMark(p)}` })),
    },
    skills: skills.map((s) => ({ id: s.id, label: s.name, group: s.group })),
    skillNames: skills.map((s) => s.name),
  };
  // An experience or project edits its skills here; they live in skill_links.
  const linkIds = (s: Skill) => (key === "experiences" ? s.experienceIds : s.projectIds);
  const item =
    key === "experiences" || key === "projects"
      ? { ...found, skillIds: isNew ? [] : skills.filter((s) => linkIds(s).includes(id)).map((s) => s.id) }
      : found;
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
