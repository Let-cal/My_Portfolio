"use server";
import { refresh } from "next/cache";
import type { ActionResult } from "./actions";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminContent } from "@/lib/admin/data";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  collectMediaLibrary,
  indexMediaUsage,
  validMediaKey,
  type MediaLibrarySnapshot,
} from "@/lib/admin/media";
type Failure = Extract<ActionResult, { ok: false }>;
function failure(error: unknown): Failure {
  const message =
    error instanceof Error ? error.message : "Không thể đọc thư viện.";
  if (message === "SESSION_EXPIRED")
    return {
      ok: false,
      code: "SESSION_EXPIRED",
      error: "Phiên đăng nhập đã hết hạn.",
    };
  if (message === "FORBIDDEN")
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Tài khoản này không có quyền quản trị.",
    };
  return { ok: false, error: message };
}
async function snapshot() {
  const content = await getAdminContent(true);
  if (!content)
    throw new Error(
      "Chưa đọc được toàn bộ nội dung để kiểm tra tệp đang dùng.",
    );
  const client = await createServerSupabase();
  const library = await collectMediaLibrary(
    client,
    content,
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
  );
  return { client, library };
}
export async function listMedia(): Promise<
  { ok: true; library: MediaLibrarySnapshot } | Failure
> {
  try {
    await requireAdmin();
    return { ok: true, library: (await snapshot()).library };
  } catch (error) {
    return failure(error);
  }
}
export async function deleteMedia(
  bucket: string,
  path: string,
): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!validMediaKey(bucket, path))
      throw new Error("Bucket hoặc đường dẫn tệp không hợp lệ.");
    const { client, library } = await snapshot();
    const file = library.files.find(
      (row) => row.bucket === bucket && row.path === path,
    );
    if (!file)
      throw new Error("Tệp không còn trong thư viện. Tải lại danh sách.");
    // Inventory traversal may take time. Re-read current references AFTER it, immediately
    // before removal. This narrows the race but cannot lock concurrent content saves.
    const latest = await getAdminContent(true);
    if (!latest)
      throw new Error("Không đọc được tham chiếu mới nhất. Tệp chưa bị xóa.");
    const uses = indexMediaUsage(
      latest,
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
    ).get(`${bucket}/${path}`);
    if (uses?.length)
      throw new Error(
        "Tệp đang được dùng. Gỡ liên kết trong nội dung trước khi xóa.",
      );
    const { data, error } = await client.storage.from(bucket).remove([path]);
    if (error) throw new Error(error.message);
    if (!data?.length)
      throw new Error("Storage chưa xác nhận xóa tệp. Tải lại danh sách.");
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
