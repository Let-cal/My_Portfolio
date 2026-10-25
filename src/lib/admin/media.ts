import type { Content } from "@/content/schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UPLOAD_RULES, validateUpload, type UploadKind } from "./upload";

export const MEDIA_BUCKETS = ["media", "files"] as const;
export type MediaBucket = (typeof MEDIA_BUCKETS)[number];
export type MediaUse = { label: string; href: string };
export type MediaFile = {
  bucket: MediaBucket;
  path: string;
  name: string;
  url: string;
  kind: UploadKind | "other";
  mime: string;
  size: number | null;
  createdAt: string | null;
  uses: MediaUse[];
};
export type MediaLibrarySnapshot = {
  files: MediaFile[];
  knownBytes: number;
  unknownSizes: number;
};
export const FREE_STORAGE_REFERENCE = 1_000_000_000;
export function validMediaKey(
  bucket: string,
  path: string,
): bucket is MediaBucket {
  return (
    (MEDIA_BUCKETS as readonly string[]).includes(bucket) &&
    path.length > 0 &&
    path.length <= 4096 &&
    !/[\\\x00-\x1f\x7f]/.test(path) &&
    path
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}
export function storageKeyFromUrl(
  value: string,
  origin: string,
): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== new URL(origin).origin) return null;
    const match = url.pathname.match(
      /^\/storage\/v1\/(?:object|render\/image)\/public\/(media|files)\/(.+)$/,
    );
    if (!match) return null;
    const path = decodeURIComponent(match[2]);
    return validMediaKey(match[1], path) ? `${match[1]}/${path}` : null;
  } catch {
    return null;
  }
}
/** Current saved content, including hidden rows. One link per editing screen and asset. */
export function indexMediaUsage(
  content: Content,
  origin: string,
): Map<string, MediaUse[]> {
  const index = new Map<string, MediaUse[]>();
  const scopes: { value: unknown; use: MediaUse }[] = [
    { value: content.profile, use: { label: "Hồ sơ", href: "/admin/profile" } },
    ...content.skills.map((r) => ({
      value: r,
      use: { label: r.name, href: `/admin/skills/${encodeURIComponent(r.id)}` },
    })),
    ...content.roles.map((r) => ({
      value: r,
      use: { label: `Vai trò ${r.title.en}`, href: "/admin/roles" },
    })),
    ...content.projects.map((r) => ({
      value: r,
      use: {
        label: r.title,
        href: `/admin/projects/${encodeURIComponent(r.id)}`,
      },
    })),
    ...content.experiences.map((r) => ({
      value: r,
      use: {
        label: r.company,
        href: `/admin/experiences/${encodeURIComponent(r.id)}`,
      },
    })),
    ...content.certificates.map((r) => ({
      value: r,
      use: {
        label: r.name,
        href: `/admin/certificates/${encodeURIComponent(r.id)}`,
      },
    })),
    ...content.activities.map((r) => ({
      value: r,
      use: {
        label: r.name.en,
        href: `/admin/activities/${encodeURIComponent(r.id)}`,
      },
    })),
    ...content.education.map((r) => ({
      value: r,
      use: {
        label: r.school,
        href: `/admin/education/${encodeURIComponent(r.id)}`,
      },
    })),
    ...content.whyCards.map((r) => ({
      value: r,
      use: {
        label: r.title.en,
        href: `/admin/why_cards/${encodeURIComponent(r.id)}`,
      },
    })),
  ];
  for (const { value, use } of scopes) {
    const add = (candidate: string) => {
      const key = storageKeyFromUrl(candidate, origin);
      if (!key) return;
      const uses = index.get(key) ?? [];
      if (!uses.some((u) => u.href === use.href && u.label === use.label))
        uses.push(use);
      index.set(key, uses);
    };
    const walk = (v: unknown) => {
      if (typeof v === "string") {
        add(v);
        for (const candidate of v.match(/https?:\/\/[^\s<>"']+/g) ?? []) {
          add(candidate);
          add(candidate.replace(/[)\],.;]+$/, ""));
        }
      } else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(value);
  }
  return index;
}
function fileKind(mime: string): UploadKind | "other" {
  return (
    (Object.keys(UPLOAD_RULES) as UploadKind[]).find((kind) =>
      UPLOAD_RULES[kind].types.includes(mime),
    ) ?? "other"
  );
}
export function canSelectMedia(
  file: Pick<MediaFile, "kind" | "mime" | "size">,
  kind: UploadKind,
): boolean {
  return (
    file.kind === kind &&
    file.size !== null &&
    validateUpload({ size: file.size, type: file.mime }, kind).ok
  );
}
export function formatMediaBytes(bytes: number | null): string {
  if (bytes === null) return "Chưa rõ dung lượng";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
}
/** Traverse every folder/page; fail closed on errors/limits instead of returning partial usage. */
export async function collectMediaLibrary(
  client: SupabaseClient,
  content: Content,
  origin: string,
): Promise<MediaLibrarySnapshot> {
  const usage = indexMediaUsage(content, origin),
    files = new Map<string, MediaFile>();
  let requests = 0;
  for (const bucket of MEDIA_BUCKETS) {
    const folders = [""],
      visited = new Set<string>();
    while (folders.length) {
      const folder = folders.shift()!;
      if (visited.has(folder)) continue;
      visited.add(folder);
      for (let offset = 0; ; offset += 100) {
        if (++requests > 2000)
          throw new Error(
            "Thư viện vượt giới hạn đọc an toàn. Không trả về dữ liệu một phần.",
          );
        const { data, error } = await client.storage.from(bucket).list(folder, {
          limit: 100,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
        if (error)
          throw new Error(`Không đọc được bucket ${bucket}: ${error.message}`);
        if (!data) throw new Error("Storage không trả về danh sách đầy đủ.");
        for (const entry of data) {
          const path = folder ? `${folder}/${entry.name}` : entry.name;
          if (entry.name.includes("/") || !validMediaKey(bucket, path))
            throw new Error("Storage trả về đường dẫn không hợp lệ.");
          if (entry.id === null && entry.metadata === null) {
            folders.push(path);
            continue;
          }
          const metadata = entry.metadata as {
            size?: unknown;
            mimetype?: unknown;
          } | null;
          const size =
            typeof metadata?.size === "number" &&
            Number.isSafeInteger(metadata.size) &&
            metadata.size >= 0
              ? metadata.size
              : null;
          const extension = entry.name.split(".").at(-1)?.toLowerCase();
          const fallback: Record<string, string> = {
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            webp: "image/webp",
            avif: "image/avif",
            mp4: "video/mp4",
            webm: "video/webm",
            pdf: "application/pdf",
          };
          const mime =
            typeof metadata?.mimetype === "string"
              ? metadata.mimetype
              : (fallback[extension ?? ""] ?? "");
          const url = `${new URL(origin).origin}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
          files.set(`${bucket}/${path}`, {
            bucket,
            path,
            name: entry.name,
            url,
            kind: fileKind(mime),
            mime,
            size,
            createdAt: entry.created_at ?? null,
            uses: usage.get(`${bucket}/${path}`) ?? [],
          });
          if (files.size > 10000)
            throw new Error(
              "Thư viện vượt 10.000 tệp. Không trả về dữ liệu một phần.",
            );
        }
        if (data.length < 100) break;
      }
    }
  }
  const list = [...files.values()].sort(
    (a, b) => a.bucket.localeCompare(b.bucket) || a.path.localeCompare(b.path),
  );
  return {
    files: list,
    knownBytes: list.reduce((sum, file) => sum + (file.size ?? 0), 0),
    unknownSizes: list.filter((file) => file.size === null).length,
  };
}
