import { ROLE_KEYS } from "@/content/schema";
import { rowToProfile, rowToRole, type SkillLinkRow } from "@/lib/data/mappers";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AdminContent } from "./health";
import { describeEdit, type EditEntry } from "./last-edited";
import { RESOURCE_KEYS, resources, type ResourceKey } from "./resources";

export type Item = Record<string, unknown> & { id: string; sortIndex: number };

/**
 * Reads a list as the signed-in admin, so unpublished rows are included.
 * Call inside <Suspense>: it reads the session cookie.
 */
export async function listItems(
  key: ResourceKey,
  complete = false,
): Promise<Item[]> {
  const resource = resources[key];
  const supabase = await createServerSupabase();
  const data: Record<string, unknown>[] = [];
  if (complete) {
    // Media deletion must see references after the API's first page, including hidden rows.
    for (let offset = 0; ; offset += 100) {
      if (offset >= 10000)
        throw new Error(
          `${resource.table}: quá nhiều mục để kiểm tra đầy đủ tham chiếu media.`,
        );
      const page = await supabase
        .from(resource.table)
        .select("*")
        .order("sort_index")
        .order("id")
        .range(offset, offset + 99);
      if (page.error)
        throw new Error(`${resource.table}: ${page.error.message}`);
      if (!page.data)
        throw new Error(
          `${resource.table}: thiếu dữ liệu kiểm tra tham chiếu media.`,
        );
      data.push(...page.data);
      if (page.data.length < 100) break;
    }
  } else {
    const result = await supabase
      .from(resource.table)
      .select("*")
      .order("sort_index");
    if (result.error)
      throw new Error(`${resource.table}: ${result.error.message}`);
    data.push(...(result.data ?? []));
  }
  let links: SkillLinkRow[] = [];
  if (key === "skills") {
    const res = await supabase
      .from("skill_links")
      .select("skill_id, experience_id, project_id");
    if (res.error) throw new Error(`skill_links: ${res.error.message}`);
    links = res.data;
  }
  return (data ?? []).map((row) => resource.fromRow(row, links) as Item);
}

export async function getItem(
  key: ResourceKey,
  id: string,
): Promise<Item | null> {
  return (await listItems(key)).find((item) => item.id === id) ?? null;
}

export type Option = { id: string; label: string };

/** Experiences and projects a skill can point to as evidence. */
export async function relationOptions(): Promise<
  Record<"experiences" | "projects", Option[]>
> {
  const [experiences, projects] = await Promise.all([
    listItems("experiences"),
    listItems("projects"),
  ]);
  return {
    experiences: experiences.map((e) => ({
      id: e.id,
      label: `${e.company} · ${e.start}`,
    })),
    projects: projects.map((p) => ({ id: p.id, label: String(p.title) })),
  };
}

export async function getProfileAndRoles() {
  const supabase = await createServerSupabase();
  const [profile, roles] = await Promise.all([
    supabase.from("profile").select("*").eq("id", "me").maybeSingle(),
    supabase.from("roles").select("*"),
  ]);
  if (profile.error) throw new Error(`profile: ${profile.error.message}`);
  if (roles.error) throw new Error(`roles: ${roles.error.message}`);
  return {
    profile: profile.data ? rowToProfile(profile.data) : null,
    roles: ROLE_KEYS.flatMap((key) =>
      roles.data.filter((r) => r.key === key).map(rowToRole),
    ),
  };
}

/** Row counts for the dashboard, as the admin sees them (hidden rows included). */
export async function countRows(): Promise<
  { key: ResourceKey; count: number; hidden: number }[]
> {
  const supabase = await createServerSupabase();
  return Promise.all(
    RESOURCE_KEYS.map(async (key) => {
      const { table, hasPublished } = resources[key];
      const all = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (all.error) throw new Error(`${table}: ${all.error.message}`);
      let hidden = 0;
      if (hasPublished) {
        const res = await supabase
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq("published", false);
        if (res.error) throw new Error(`${table}: ${res.error.message}`);
        hidden = res.count ?? 0;
      }
      return { key, count: all.count ?? 0, hidden };
    }),
  );
}

/**
 * Everything, hidden items included, in the public content shape (for health checks and the
 * matrix). Null while the database has no profile row yet (run `npm run db:seed`).
 */
export async function getAdminContent(
  complete = false,
): Promise<AdminContent | null> {
  const [lists, { profile, roles }] = await Promise.all([
    Promise.all(
      RESOURCE_KEYS.map(
        async (key) => [key, await listItems(key, complete)] as const,
      ),
    ),
    getProfileAndRoles(),
  ]);
  const byKey = Object.fromEntries(lists) as Record<ResourceKey, Item[]>;
  if (!profile) return null;
  return {
    profile,
    roles,
    experiences: byKey.experiences,
    projects: byKey.projects,
    skills: byKey.skills,
    certificates: byKey.certificates,
    activities: byKey.activities,
    education: byKey.education,
    whyCards: byKey.why_cards,
  } as unknown as AdminContent;
}

/** The most recently edited row across the content tables and skill links, for "Sửa gần nhất". */
export async function lastEdited(): Promise<EditEntry | null> {
  const supabase = await createServerSupabase();
  const tables = [
    "profile",
    "roles",
    "skill_links",
    ...RESOURCE_KEYS.map((k) => resources[k].table),
  ];
  const latest = await Promise.all(
    tables.map(async (table) => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(`${table}: ${error.message}`);
      const row = data?.[0] as Record<string, unknown> | undefined;
      return row ? describeEdit(table, row) : null;
    }),
  );
  return (
    latest
      .filter((x) => x !== null)
      .sort((a, b) => b.at.localeCompare(a.at))[0] ?? null
  );
}
