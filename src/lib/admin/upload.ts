// Upload rules shared by the browser (early feedback) and the server action (enforcement).

export type UploadKind = "image" | "video" | "pdf";

const MB = 1024 * 1024;

export const UPLOAD_RULES: Record<UploadKind, { maxBytes: number; types: readonly string[] }> = {
  image: { maxBytes: 5 * MB, types: ["image/jpeg", "image/png", "image/webp", "image/avif"] },
  video: { maxBytes: 8 * MB, types: ["video/mp4", "video/webm"] },
  pdf: { maxBytes: 10 * MB, types: ["application/pdf"] },
};

export function validateUpload(
  file: { size: number; type: string },
  kind: UploadKind,
): { ok: true } | { ok: false; reason: string } {
  const rule = UPLOAD_RULES[kind];
  if (!rule.types.includes(file.type)) {
    return { ok: false, reason: `Định dạng ${file.type || "không rõ"} không được hỗ trợ (cho phép: ${rule.types.join(", ")}).` };
  }
  if (file.size <= 0) return { ok: false, reason: "Tệp rỗng." };
  if (file.size > rule.maxBytes) {
    return { ok: false, reason: `Tệp lớn hơn ${rule.maxBytes / MB} MB.` };
  }
  return { ok: true };
}

export function bucketFor(kind: UploadKind): "media" | "files" {
  return kind === "pdf" ? "files" : "media";
}

/** `<kind>/<unique>-<slug>.<ext>`, ASCII only, so the public URL needs no escaping. */
export function storagePath(kind: UploadKind, fileName: string, unique: string): string {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = (dot > 0 ? fileName.slice(0, dot) : fileName)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${kind}/${unique}-${base || "file"}${ext ? `.${ext}` : ""}`;
}
