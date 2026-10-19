import type { SkillLinkRow } from "@/lib/data/mappers";
import { createServerSupabase } from "@/lib/supabase/server";
import { resources, type ResourceKey } from "./resources";

export type Item = Record<string, unknown> & { id: string; sortIndex: number };

/**
 * Reads a list as the signed-in admin, so unpublished rows are included.
 * Call inside <Suspense>: it reads the session cookie.
 */
export async function listItems(key: ResourceKey): Promise<Item[]> {
  const resource = resources[key];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from(resource.table).select("*").order("sort_index");
  if (error) throw new Error(`${resource.table}: ${error.message}`);
  let links: SkillLinkRow[] = [];
  if (key === "skills") {
    const res = await supabase.from("skill_links").select("skill_id, experience_id, project_id");
    if (res.error) throw new Error(`skill_links: ${res.error.message}`);
    links = res.data;
  }
  return (data ?? []).map((row) => resource.fromRow(row, links) as Item);
}

export async function getItem(key: ResourceKey, id: string): Promise<Item | null> {
  return (await listItems(key)).find((item) => item.id === id) ?? null;
}

export type Option = { id: string; label: string };

/** Experiences and projects a skill can point to as evidence. */
export async function relationOptions(): Promise<Record<"experiences" | "projects", Option[]>> {
  const [experiences, projects] = await Promise.all([listItems("experiences"), listItems("projects")]);
  return {
    experiences: experiences.map((e) => ({ id: e.id, label: `${e.company} · ${e.start}` })),
    projects: projects.map((p) => ({ id: p.id, label: String(p.title) })),
  };
}
