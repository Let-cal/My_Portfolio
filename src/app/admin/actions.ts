"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { profileToRow, roleToRow } from "@/lib/data/mappers";
import {
  diffLinks,
  linkMatch,
  linkRow,
  type LinkTarget,
} from "@/lib/admin/links";
import {
  isResourceKey,
  resources,
  type FieldSpec,
  type ResourceKey,
} from "@/lib/admin/resources";
import { PROFILE_FIELDS, ROLE_FIELDS } from "@/lib/admin/singletons";
import { copyId } from "@/lib/admin/list-view";
import type { Version } from "@/lib/admin/versions";
import { VERSIONED_TABLES } from "@/lib/data/schema-sql";
import { describeIssues } from "@/lib/admin/validation";
import { requireAdmin } from "@/lib/admin/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { profileSchema, roleSchema, type Skill } from "@/content/schema";

/** `fieldErrors` maps a form path (e.g. "description.en") to the message shown under that input. */
export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** A failure that belongs to specific inputs; the form shows each message on its field. */
class FormError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string>,
  ) {
    super(message);
  }
}

const fail = (error: unknown): ActionResult =>
  error instanceof FormError
    ? { ok: false, error: error.message, fieldErrors: error.fieldErrors }
    : {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };

type ParseResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: {
        issues: { path: PropertyKey[]; code: string; message: string }[];
      };
    };

/** The parsed data, or a FormError with one Vietnamese message per failing input. */
function parsedOrFieldErrors<T>(
  result: ParseResult<T>,
  fields: FieldSpec[],
  values: unknown,
): T {
  if (result.success) return result.data;
  const errors = describeIssues(result.error.issues, fields, values);
  throw new FormError(
    `Có ${errors.length} mục cần sửa`,
    Object.fromEntries(errors.map((e) => [e.path, e.message])),
  );
}

/** Every action: admin check first, then the write (still checked by RLS), then a fresh site cache. */
async function adminWrite(
  key: string,
  write: (k: ResourceKey) => Promise<void>,
): Promise<ActionResult> {
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
export async function saveResource(
  key: string,
  data: Record<string, unknown>,
  isNew: boolean,
) {
  return adminWrite(key, async (k) => {
    const resource = resources[k];
    const supabase = await createServerSupabase();
    const { skillIds, ...fields } = data;
    data = fields;
    const id = String(data.id ?? "");
    const { data: existing, error } = await supabase
      .from(resource.table)
      .select("id, sort_index")
      .order("sort_index", { ascending: false });
    check(error);
    const current = existing?.find((row) => row.id === id);
    if (isNew && current) {
      throw new FormError("ID đã được dùng", {
        id: `ID "${id}" đã được dùng, chọn ID khác`,
      });
    }
    if (!isNew && !current) throw new Error(`Không tìm thấy "${id}".`);
    const sortIndex = current
      ? current.sort_index
      : (existing?.[0]?.sort_index ?? -1) + 1;

    const item = parsedOrFieldErrors(
      resource.schema.safeParse({ ...data, sortIndex }) as ParseResult<
        Record<string, unknown>
      >,
      resource.fields,
      data,
    );

    const { error: upsertError } = await supabase
      .from(resource.table)
      .upsert(resource.toRow(item), { onConflict: "id" });
    check(upsertError);
    if (k === "skills") {
      // Only the links that changed are written, so history records real unlinks, not churn.
      const skill = item as Skill;
      const key = (t: LinkTarget) =>
        "experienceId" in t ? `exp:${t.experienceId}` : `proj:${t.projectId}`;
      const targets = new Map<string, LinkTarget>([
        ...skill.experienceIds.map(
          (e) => [`exp:${e}`, { experienceId: e }] as const,
        ),
        ...skill.projectIds.map(
          (p) => [`proj:${p}`, { projectId: p }] as const,
        ),
      ]);
      const { data: rows, error: linkError } = await supabase
        .from("skill_links")
        .select("*")
        .eq("skill_id", id);
      check(linkError);
      const current = new Map<string, LinkTarget>(
        (rows ?? []).map((r) => {
          const t: LinkTarget = r.experience_id
            ? { experienceId: r.experience_id as string }
            : { projectId: r.project_id as string };
          return [key(t), t];
        }),
      );
      const { add, remove } = diffLinks(
        [...current.keys()],
        [...targets.keys()],
      );
      if (add.length)
        check(
          (
            await supabase
              .from("skill_links")
              .insert(add.map((k2) => linkRow(id, targets.get(k2)!)))
          ).error,
        );
      for (const k2 of remove)
        check(
          (
            await supabase
              .from("skill_links")
              .delete()
              .match(linkMatch(id, current.get(k2)!))
          ).error,
        );
    }
    if ((k === "experiences" || k === "projects") && Array.isArray(skillIds)) {
      const column = k === "experiences" ? "experience_id" : "project_id";
      const target: LinkTarget =
        k === "experiences" ? { experienceId: id } : { projectId: id };
      const { data: rows, error: linkError } = await supabase
        .from("skill_links")
        .select("skill_id")
        .eq(column, id);
      check(linkError);
      const { add, remove } = diffLinks(
        (rows ?? []).map((r) => r.skill_id as string),
        skillIds as string[],
      );
      if (add.length)
        check(
          (
            await supabase
              .from("skill_links")
              .insert(add.map((skillId) => linkRow(skillId, target)))
          ).error,
        );
      for (const skillId of remove)
        check(
          (
            await supabase
              .from("skill_links")
              .delete()
              .match(linkMatch(skillId, target))
          ).error,
        );
    }
  });
}

const linkChange = z
  .object({
    skillId: z.string().min(1),
    experienceId: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
    linked: z.boolean(),
  })
  .strict()
  .refine(
    (c) => (c.experienceId === undefined) !== (c.projectId === undefined),
    "Exactly one target",
  );

export type LinkChange = z.infer<typeof linkChange>;

/**
 * Saves the matrix's pending changes in one go: links are upserted (duplicates ignored),
 * unlinks deleted one by one, then the public site cache is refreshed once.
 */
export async function saveSkillLinks(
  changes: LinkChange[],
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = z.array(linkChange).max(1000).safeParse(changes);
    if (!parsed.success) throw new Error("Thay đổi không hợp lệ.");
    const target = (c: LinkChange): LinkTarget =>
      c.experienceId !== undefined
        ? { experienceId: c.experienceId }
        : { projectId: c.projectId! };
    const supabase = await createServerSupabase();
    const add = parsed.data
      .filter((c) => c.linked)
      .map((c) => linkRow(c.skillId, target(c)));
    if (add.length) {
      check(
        (
          await supabase.from("skill_links").upsert(add, {
            onConflict: "skill_id,experience_id,project_id",
            ignoreDuplicates: true,
          })
        ).error,
      );
    }
    for (const c of parsed.data.filter((x) => !x.linked)) {
      check(
        (
          await supabase
            .from("skill_links")
            .delete()
            .match(linkMatch(c.skillId, target(c)))
        ).error,
      );
    }
    updateTag("content");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteResource(key: string, id: string) {
  return adminWrite(key, async (k) => {
    const supabase = await createServerSupabase();
    const { error, count } = await supabase
      .from(resources[k].table)
      .delete({ count: "exact" })
      .eq("id", id);
    check(error);
    if (!count) throw new Error(`Không xóa được "${id}".`);
  });
}

/**
 * Copies one item to a new id at the end of the list. The copy starts hidden, so it never shows
 * on the public site before it is edited. Lists that cannot hide items copy through the new-item
 * form instead (`/admin/<key>/new?from=<id>`), which writes nothing until Save.
 */
export async function duplicateResource(
  key: string,
  id: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let newId = "";
  const result = await adminWrite(key, async (k) => {
    const resource = resources[k];
    if (!resource.hasPublished)
      throw new Error("Mục này nhân bản qua form tạo mới.");
    const supabase = await createServerSupabase();
    const { data: all, error } = await supabase
      .from(resource.table)
      .select("id, sort_index")
      .order("sort_index", { ascending: false });
    check(error);
    const { data: rows, error: rowError } = await supabase
      .from(resource.table)
      .select("*")
      .eq("id", id);
    check(rowError);
    const source = rows?.[0] as Record<string, unknown> | undefined;
    if (!source) throw new Error(`Không tìm thấy "${id}".`);
    const { created_at: _c, updated_at: _u, ...copy } = source;
    void _c;
    void _u;
    newId = copyId(
      id,
      (all ?? []).map((r) => r.id as string),
    );
    copy.id = newId;
    copy.sort_index = (all?.[0]?.sort_index ?? -1) + 1;
    copy.published = false;
    check((await supabase.from(resource.table).insert(copy)).error);
  });
  return result.ok
    ? { ok: true, id: newId }
    : { ok: false, error: result.error };
}

/** Saves a new order: each id gets its position in the list as sort_index. */
export async function reorderResource(key: string, ids: string[]) {
  return adminWrite(key, async (k) => {
    const supabase = await createServerSupabase();
    const table = resources[k].table;
    const results = await Promise.all(
      ids.map((id, index) =>
        supabase.from(table).update({ sort_index: index }).eq("id", id),
      ),
    );
    for (const { error } of results) check(error);
  });
}

export async function togglePublished(key: string, id: string, value: boolean) {
  return adminWrite(key, async (k) => {
    if (!resources[k].hasPublished)
      throw new Error("Mục này không có trạng thái ẩn/hiện.");
    const supabase = await createServerSupabase();
    check(
      (
        await supabase
          .from(resources[k].table)
          .update({ published: value })
          .eq("id", id)
      ).error,
    );
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

export async function saveProfile(data: Record<string, unknown>) {
  return adminSave(async () => {
    const profile = parsedOrFieldErrors(
      profileSchema.safeParse(data) as ParseResult<
        z.infer<typeof profileSchema>
      >,
      PROFILE_FIELDS,
      data,
    );
    const supabase = await createServerSupabase();
    check(
      (
        await supabase
          .from("profile")
          .upsert({ id: "me", ...profileToRow(profile) }, { onConflict: "id" })
      ).error,
    );
  });
}

export async function setOpenToWork(value: boolean) {
  return adminSave(async () => {
    const supabase = await createServerSupabase();
    check(
      (
        await supabase
          .from("profile")
          .update({ open_to_work: value })
          .eq("id", "me")
      ).error,
    );
  });
}

export async function saveRole(data: Record<string, unknown>) {
  return adminSave(async () => {
    const role = parsedOrFieldErrors(
      roleSchema.safeParse(data) as ParseResult<z.infer<typeof roleSchema>>,
      ROLE_FIELDS,
      data,
    );
    const supabase = await createServerSupabase();
    check(
      (
        await supabase
          .from("roles")
          .upsert(roleToRow(role), { onConflict: "key" })
      ).error,
    );
  });
}

/** History of one item: its saved versions (newest first) and the row as it is now. */
export async function listVersions(
  table: string,
  itemKey: string,
): Promise<
  | { ok: true; versions: Version[]; current: Record<string, unknown> | null }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    if (!(VERSIONED_TABLES as string[]).includes(table))
      throw new Error(`Unknown table: ${table}`);
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("admin_list_versions", {
      p_table: table,
      p_key: itemKey,
    });
    check(error);
    const { data: rows, error: rowError } = await supabase
      .from(table)
      .select("*")
      .eq(table === "roles" ? "key" : "id", itemKey);
    check(rowError);
    const versions = ((data ?? []) as Record<string, unknown>[]).map((v) => ({
      id: Number(v.id),
      op: v.op as Version["op"],
      oldRow: v.old_row as Record<string, unknown>,
      changedBy: (v.changed_by as string | null) ?? null,
      changedAt: String(v.changed_at),
    }));
    return {
      ok: true,
      versions,
      current: (rows?.[0] as Record<string, unknown> | undefined) ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Writes a saved version back. The restore is itself a new version, so it can be undone too. */
export async function restoreVersion(versionId: number): Promise<ActionResult> {
  return adminSave(async () => {
    const supabase = await createServerSupabase();
    check(
      (await supabase.rpc("admin_restore_version", { p_version_id: versionId }))
        .error,
    );
  });
}

/** "Hoàn tác" after a delete: brings back the newest deleted copy of the item (and its skill links). */
export async function undoDelete(
  table: string,
  itemKey: string,
): Promise<ActionResult> {
  const listed = await listVersions(table, itemKey);
  if (!listed.ok) return listed;
  const deleted = listed.versions.find((v) => v.op === "delete");
  if (!deleted)
    return { ok: false, error: "Không còn bản đã xóa để hoàn tác." };
  return restoreVersion(deleted.id);
}
