import { FormSkeleton } from "@/components/admin/Skeletons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { getAdminAccess } from "@/lib/admin/access";
import { emptyItem } from "@/lib/admin/empty-item";
import type { Options } from "@/components/admin/ResourceForm";
import type { Skill } from "@/content/schema";
import { getItem, listItems, relationOptions } from "@/lib/admin/data";
import { copyId, neighbours } from "@/lib/admin/list-view";
import { tableFor } from "@/lib/admin/versions";
import { VersionHistory } from "@/components/admin/VersionHistory";
import { isResourceKey, resources } from "@/lib/admin/resources";

type Params = Promise<{ resource: string; id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Editor({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ resource: key, id }, sp] = await Promise.all([params, searchParams]);
  if (!isResourceKey(key)) notFound();
  const isNew = id === "new";
  // "Nhân bản" for lists that cannot hide items: a new, unsaved item pre-filled from `from`.
  const from = isNew && typeof sp.from === "string" ? sp.from : null;
  // Creating (new or a copy) is the admin's only; the reviewer gets a way back instead of a form.
  if (isNew && (await getAdminAccess())?.kind !== "admin")
    return (
      <p
        role="status"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm"
      >
        Chế độ chỉ đọc: không tạo mục mới.
        <Link href={`/admin/${key}`} className="font-medium underline">
          ← {resources[key].label}
        </Link>
      </p>
    );
  const needsSkills =
    key === "experiences" ||
    key === "projects" ||
    key === "certificates" ||
    key === "activities";
  const [found, relations, skills] = await Promise.all([
    from
      ? getItem(key, from)
      : isNew
        ? Promise.resolve(emptyItem(key))
        : getItem(key, id),
    key === "skills"
      ? relationOptions()
      : Promise.resolve({ experiences: [], projects: [] }),
    needsSkills
      ? (listItems("skills") as unknown as Promise<Skill[]>)
      : Promise.resolve([] as Skill[]),
  ]);
  if (!found) notFound();
  const [ownList, experiences, projects] = await Promise.all([
    listItems(key),
    key === "why_cards" ? listItems("experiences") : Promise.resolve([]),
    key === "why_cards" ? listItems("projects") : Promise.resolve([]),
  ]);
  let source: Record<string, unknown> = found;
  if (from) {
    const { sortIndex: _s, ...copy } = found as Record<string, unknown>;
    void _s;
    source = {
      ...copy,
      id: copyId(
        from,
        ownList.map((i) => i.id),
      ),
    };
  }
  const hiddenMark = (item: Record<string, unknown>) =>
    item.published === false ? " (đang ẩn)" : "";
  const options: Options = {
    ...relations,
    // Only a new item can clash with an existing id; an edit keeps its own.
    existingIds: isNew ? ownList.map((i) => i.id) : [],
    evidence: {
      experiences: experiences.map((e) => ({
        id: e.id,
        label: `${String(e.company)} · ${String(e.start)}${hiddenMark(e)}`,
      })),
      projects: projects.map((p) => ({
        id: p.id,
        label: `${String(p.title)}${hiddenMark(p)}`,
      })),
    },
    skills: skills.map((s) => ({ id: s.id, label: s.name, group: s.group })),
    skillNames: skills.map((s) => s.name),
  };
  // An experience or project edits its skills here; they live in skill_links.
  const linkIds = (s: Skill) =>
    key === "experiences" ? s.experienceIds : s.projectIds;
  const item =
    key === "experiences" || key === "projects"
      ? {
          ...source,
          skillIds:
            isNew && !from
              ? []
              : skills
                  .filter((s) => linkIds(s).includes(from ?? id))
                  .map((s) => s.id),
        }
      : source;
  const nav = isNew
    ? null
    : neighbours(
        ownList.map((i) => i.id),
        id,
      );
  const navLink =
    "text-sm text-muted-foreground hover:text-foreground hover:underline";
  return (
    <>
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={`/admin/${key}`} className={navLink}>
            ← {resources[key].label}
          </Link>
          {nav && (nav.prev || nav.next) && (
            <nav aria-label="Mục khác trong danh sách" className="flex gap-4">
              {nav.prev ? (
                <Link
                  href={`/admin/${key}/${nav.prev}`}
                  className={navLink}
                  aria-label={`Mục trước: ${nav.prev}`}
                >
                  ← Trước
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground/50" aria-hidden>
                  ← Trước
                </span>
              )}
              {nav.next ? (
                <Link
                  href={`/admin/${key}/${nav.next}`}
                  className={navLink}
                  aria-label={`Mục sau: ${nav.next}`}
                >
                  Sau →
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground/50" aria-hidden>
                  Sau →
                </span>
              )}
            </nav>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">
            {from ? `Nhân bản ${from}` : isNew ? "Thêm mới" : `Sửa ${id}`}
          </h1>
          {!isNew && <VersionHistory table={tableFor(key)} itemKey={id} />}
        </div>
      </header>
      <ResourceForm
        resourceKey={key}
        initial={item}
        isNew={isNew}
        options={options}
      />
    </>
  );
}

export default function EditResourcePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <main className="flex flex-col gap-4">
      <Suspense fallback={<FormSkeleton />}>
        <Editor params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
