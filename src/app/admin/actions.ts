"use server";

import { requireContentRead } from "@/lib/admin/access";
import { refresh, updateTag } from "next/cache";
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
import { starRefusal } from "@/lib/featured";

/** `fieldErrors` maps a form path (e.g. "description.en") to the message shown under that input. */
/** Why a write failed, for the client to react: sign in again, refuse, or offer a retry. */
export type ActionErrorCode =
  "SESSION_EXPIRED" | "FORBIDDEN" | "NETWORK" | "STALE";

export type ActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      code?: ActionErrorCode;
    };

/** A failure that belongs to specific inputs; the form shows each message on its field. */
class FormError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string>,
  ) {
    super(message);
  }
}

const fail = (error: unknown): Extract<ActionResult, { ok: false }> => {
  if (error instanceof FormError)
    return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
  const message = error instanceof Error ? error.message : String(error);
  if (message === "SESSION_EXPIRED")
    return {
      ok: false,
      error: "Phiên đăng nhập đã hết hạn.",
      code: "SESSION_EXPIRED",
    };
  if (message === "FORBIDDEN")
    return {
      ok: false,
      error: "Tài khoản này không có quyền quản trị.",
      code: "FORBIDDEN",
    };
  return { ok: false, error: message };
};

/** Revalidate reauthentication without refreshing the editor or writing content. */
export async function checkAdminSession(): Promise<ActionResult> {
  try {
    // The read-only reviewer has a valid session too; only writes need requireAdmin().
    await requireContentRead();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

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
    // Admin screens re-render with the new data (updateTag only refreshes the public site).
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/**
 * Why the database refused to restore a version (SQLSTATE 22023), in Vietnamese. The experience tree
 * migration blocks the old versions of the stints whose content moved into a project, and names that project.
 */
function restoreRefusal(message: string): string {
  const reason = message.replace(/^cannot restore version \d+:\s*/, "");
  const moved = /content moved to project (\S+) \(experience tree\)/.exec(
    reason,
  );
  return moved
    ? `Không khôi phục được phiên bản này: nội dung đã chuyển sang dự án "${moved[1]}" (cây kinh nghiệm). Hãy khôi phục dự án đó.`
    : `Không khôi phục được phiên bản này: ${reason}`;
}

/** Like `check`, for the history RPCs: a missing function means migration 0004 is not applied. */
function checkRpc(error: { message: string; code?: string } | null) {
  if (error?.code === "22023") throw new Error(restoreRefusal(error.message));
  if (
    error &&
    (error.code === "PGRST202" ||
      error.message.includes("Could not find the function"))
  ) {
    throw new Error(
      "Lịch sử chưa được bật trên database (cần áp migration 0004).",
    );
  }
  check(error);
}

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;
/** A project's star as stored: the action, never the form, decides `featured_order`. */
type StarRow = {
  id: string;
  featured?: boolean | null;
  featured_order?: number | null;
};

const stars = (rows: StarRow[]) =>
  rows.map((r) => ({ id: r.id, featured: Boolean(r.featured) }));

/** The order a new star takes: after the last starred project. */
function nextFeaturedOrder(rows: StarRow[]): number {
  return (
    Math.max(
      0,
      ...rows.filter((r) => r.featured).map((r) => r.featured_order ?? 0),
    ) + 1
  );
}

async function starRows(supabase: Supabase): Promise<StarRow[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, featured, featured_order")
    .order("sort_index");
  check(error);
  return (data ?? []) as StarRow[];
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
      // Projects also read their star, for the limit and the featured order (typed as the common columns).
      .select(
        (k === "projects"
          ? "id, sort_index, featured, featured_order"
          : "id, sort_index") as "id, sort_index",
      )
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
    if (k === "projects") {
      // The star obeys the limit of three; its place in the order belongs to the featured strip.
      const rows = (existing ?? []) as unknown as StarRow[];
      if (item.featured) {
        const refusal = starRefusal(stars(rows), id);
        if (refusal) throw new FormError(refusal, { featured: refusal });
      }
      const was = rows.find((r) => r.id === id);
      item.featuredOrder = !item.featured
        ? null
        : was?.featured && was.featured_order != null
          ? was.featured_order
          : nextFeaturedOrder(rows);
    }

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
    // Admin screens re-render with the new data (updateTag only refreshes the public site).
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Projects point at their stint or school; the database refuses to delete one that still has projects. */
const PROJECT_OWNER: Partial<Record<ResourceKey, string>> = {
  experiences: "experience_id",
  education: "education_id",
};

const stillHasProjects = (n: number) =>
  `Còn ${n} dự án thuộc mục này. Chuyển các dự án sang mục khác trước khi xóa.`;

async function projectsIn(
  supabase: Supabase,
  column: string,
  id: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq(column, id);
  check(error);
  return data?.length ?? 0;
}

export async function deleteResource(key: string, id: string) {
  return adminWrite(key, async (k) => {
    const supabase = await createServerSupabase();
    const owner = PROJECT_OWNER[k];
    if (owner) {
      const attached = await projectsIn(supabase, owner, id);
      if (attached > 0) throw new Error(stillHasProjects(attached));
    }
    const { error, count } = await supabase
      .from(resources[k].table)
      .delete({ count: "exact" })
      .eq("id", id);
    // A project moved here between the check and the delete: the foreign key (on delete restrict) refuses.
    if (owner && error?.code === "23503")
      throw new Error(
        stillHasProjects(Math.max(1, await projectsIn(supabase, owner, id))),
      );
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
): Promise<{ ok: true; id: string } | Extract<ActionResult, { ok: false }>> {
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
    // A copy never takes a star: the home page holds at most three.
    if (k === "projects") {
      copy.featured = false;
      copy.featured_order = null;
    }
    check((await supabase.from(resource.table).insert(copy)).error);
  });
  // Keep the failure's code (e.g. FORBIDDEN, SESSION_EXPIRED) so the client can react to it.
  return result.ok ? { ok: true, id: newId } : result;
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

const projectId = z.string().min(1).max(200);

/**
 * Stars or unstars a project for the home page. A star goes to the end of the featured order; a 4th star is
 * refused with the limit message. Removing a star is never refused.
 */
export async function toggleFeatured(id: string): Promise<ActionResult> {
  return adminWrite("projects", async () => {
    const parsed = projectId.safeParse(id);
    if (!parsed.success) throw new Error("Dự án không hợp lệ.");
    const supabase = await createServerSupabase();
    const rows = await starRows(supabase);
    const target = rows.find((r) => r.id === parsed.data);
    if (!target) throw new Error(`Không tìm thấy "${parsed.data}".`);
    let change: { featured: boolean; featured_order: number | null };
    if (target.featured) {
      change = { featured: false, featured_order: null };
    } else {
      const refusal = starRefusal(stars(rows), target.id);
      if (refusal) throw new Error(refusal);
      change = { featured: true, featured_order: nextFeaturedOrder(rows) };
    }
    check(
      (await supabase.from("projects").update(change).eq("id", target.id))
        .error,
    );
  });
}

/**
 * Saves the order of the featured strip: `ids` must be exactly the starred projects (no other id, none
 * missing, no repeat), and each gets its position as `featured_order` 1..n.
 */
export async function reorderFeatured(ids: string[]): Promise<ActionResult> {
  return adminWrite("projects", async () => {
    const parsed = z.array(projectId).max(50).safeParse(ids);
    if (!parsed.success) throw new Error("Thứ tự không hợp lệ.");
    const wanted = parsed.data;
    const supabase = await createServerSupabase();
    const starred = new Set(
      (await starRows(supabase)).filter((r) => r.featured).map((r) => r.id),
    );
    const same =
      new Set(wanted).size === wanted.length &&
      wanted.length === starred.size &&
      wanted.every((id) => starred.has(id));
    if (!same)
      throw new Error(
        "Danh sách dự án nổi bật vừa thay đổi. Tải lại trang rồi sắp xếp lại.",
      );
    const results = await Promise.all(
      wanted.map((id, index) =>
        supabase
          .from("projects")
          .update({ featured_order: index + 1 })
          .eq("id", id),
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
    // Admin screens re-render with the new data (updateTag only refreshes the public site).
    refresh();
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
    // Reading history is open to the read-only reviewer; restoring stays admin-only.
    await requireContentRead();
    if (!(VERSIONED_TABLES as string[]).includes(table))
      throw new Error(`Unknown table: ${table}`);
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("admin_list_versions", {
      p_table: table,
      p_key: itemKey,
    });
    checkRpc(error);
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
    return fail(error);
  }
}

/** Writes a saved version back. The restore is itself a new version, so it can be undone too. */
export async function restoreVersion(versionId: number): Promise<ActionResult> {
  return adminSave(async () => {
    const supabase = await createServerSupabase();
    checkRpc(
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
  // A write: refuse non-admins (the read-only reviewer too) before reading anything.
  try {
    await requireAdmin();
  } catch (error) {
    return fail(error);
  }
  const listed = await listVersions(table, itemKey);
  if (!listed.ok) return listed;
  const deleted = listed.versions.find((v) => v.op === "delete");
  if (!deleted)
    return { ok: false, error: "Không còn bản đã xóa để hoàn tác." };
  return restoreVersion(deleted.id);
}
