"use server";

import { updateTag } from "next/cache";
import { profileToRow, roleToRow, skillToLinkRows } from "@/lib/data/mappers";
import { isResourceKey, resources, type ResourceKey } from "@/lib/admin/resources";
import { requireAdmin } from "@/lib/admin/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { profileSchema, roleSchema, type Skill } from "@/content/schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (error: unknown): ActionResult => ({
  ok: false,
  error: error instanceof Error ? error.message : String(error),
});

/** Every action: admin check first, then the write (still checked by RLS), then a fresh site cache. */
async function adminWrite(key: string, write: (k: ResourceKey) => Promise<void>): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!isResourceKey(key)) throw new Error(`Unknown resource: ${key}`);
    await write(key);
    updateTag("content");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Creates or updates one item. New items go to the end of the list. */
export async function saveResource(key: string, data: Record<string, unknown>, isNew: boolean) {
  return adminWrite(key, async (k) => {
    const resource = resources[k];
    const supabase = await createServerSupabase();
    const id = String(data.id ?? "");
    const { data: existing, error } = await supabase
      .from(resource.table)
      .select("id, sort_index")
      .order("sort_index", { ascending: false });
    check(error);
    const current = existing?.find((row) => row.id === id);
    if (isNew && current) throw new Error(`ID "${id}" đã tồn tại.`);
    if (!isNew && !current) throw new Error(`Không tìm thấy "${id}".`);
    const sortIndex = current ? current.sort_index : (existing?.[0]?.sort_index ?? -1) + 1;

    const parsed = resource.schema.safeParse({ ...data, sortIndex });
    if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const item = parsed.data as Record<string, unknown>;

    const { error: upsertError } = await supabase.from(resource.table).upsert(resource.toRow(item), { onConflict: "id" });
    check(upsertError);
    if (k === "skills") {
      check((await supabase.from("skill_links").delete().eq("skill_id", id)).error);
      const links = skillToLinkRows(item as Skill);
      if (links.length) check((await supabase.from("skill_links").insert(links)).error);
    }
  });
}

export async function deleteResource(key: string, id: string) {
  return adminWrite(key, async (k) => {
    const supabase = await createServerSupabase();
    const { error, count } = await supabase.from(resources[k].table).delete({ count: "exact" }).eq("id", id);
    check(error);
    if (!count) throw new Error(`Không xóa được "${id}".`);
  });
}

/** Saves a new order: each id gets its position in the list as sort_index. */
export async function reorderResource(key: string, ids: string[]) {
  return adminWrite(key, async (k) => {
    const supabase = await createServerSupabase();
    const table = resources[k].table;
    const results = await Promise.all(
      ids.map((id, index) => supabase.from(table).update({ sort_index: index }).eq("id", id)),
    );
    for (const { error } of results) check(error);
  });
}

export async function togglePublished(key: string, id: string, value: boolean) {
  return adminWrite(key, async (k) => {
    if (!resources[k].hasPublished) throw new Error("Mục này không có trạng thái ẩn/hiện.");
    const supabase = await createServerSupabase();
    check((await supabase.from(resources[k].table).update({ published: value }).eq("id", id)).error);
  });
}

/** Profile and roles are single records rather than lists, so they get their own actions. */
async function adminSave(write: () => Promise<void>): Promise<ActionResult> {
  try {
    await requireAdmin();
    await write();
    updateTag("content");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

function parsed<T>(result: { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } }): T {
  if (!result.success) throw new Error(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return result.data;
}

export async function saveProfile(data: Record<string, unknown>) {
  return adminSave(async () => {
    const profile = parsed(profileSchema.safeParse(data));
    const supabase = await createServerSupabase();
    check((await supabase.from("profile").upsert({ id: "me", ...profileToRow(profile) }, { onConflict: "id" })).error);
  });
}

export async function setOpenToWork(value: boolean) {
  return adminSave(async () => {
    const supabase = await createServerSupabase();
    check((await supabase.from("profile").update({ open_to_work: value }).eq("id", "me")).error);
  });
}

export async function saveRole(data: Record<string, unknown>) {
  return adminSave(async () => {
    const role = parsed(roleSchema.safeParse(data));
    const supabase = await createServerSupabase();
    check((await supabase.from("roles").upsert(roleToRow(role), { onConflict: "key" })).error);
  });
}
