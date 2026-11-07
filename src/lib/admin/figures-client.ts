// Browser-side helpers for the figures field and the project save: Mermaid rendering,
// SVG and image uploads to the media bucket, and image size reading. Admin only.
// The renderer is imported statically: a lazy import would add a chunk, and every
// chunk adds an entry to the webpack runtime that public pages load too. Mermaid
// itself is fetched from public/vendor on the first render (see render-diagram.ts).
import type { DiagramTheme } from "@/lib/figures/mermaid-theme";
import {
  renderDiagram,
  type RenderedDiagram,
} from "@/lib/admin/render-diagram";
import {
  FIGURE_WEBP_QUALITY,
  figureTargetSize,
  type EncodedImage,
} from "@/lib/admin/figure-image";
import { storagePath, validateUpload } from "@/lib/admin/upload";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export const SVG_CONTENT_TYPE = "image/svg+xml; charset=utf-8";

/** renderDiagram; Mermaid loads on the first call. */
export function lazyRenderDiagram(
  source: string,
  theme: DiagramTheme,
): Promise<RenderedDiagram> {
  return renderDiagram(source, theme);
}

/**
 * Uploads a rendered diagram to media/<path>. The path carries a hash of the SVG, so an
 * existing object at that path holds the same rendering and is simply replaced.
 */
export async function uploadDiagramSvg(
  path: string,
  svg: string,
): Promise<string> {
  const supabase = createBrowserSupabase();
  const bucket = supabase.storage.from("media");
  const { error } = await bucket.upload(
    path,
    new Blob([svg], { type: SVG_CONTENT_TYPE }),
    { contentType: SVG_CONTENT_TYPE, upsert: true },
  );
  if (error) throw new Error(error.message);
  return bucket.getPublicUrl(path).data.publicUrl;
}

/** Uploads an image file to media/image/ and returns its public URL. */
export async function uploadImage(file: File): Promise<string> {
  const check = validateUpload(file, "image");
  if (!check.ok) throw new Error(check.reason);
  const supabase = createBrowserSupabase();
  const bucket = supabase.storage.from("media");
  const path = storagePath("image", file.name, crypto.randomUUID().slice(0, 8));
  const { error } = await bucket.upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return bucket.getPublicUrl(path).data.publicUrl;
}

/**
 * Encodes an image file as WebP, at most 1920 px wide (spec 6.2). Null when this browser has no
 * createImageBitmap or canvas, or its toBlob ignores the WebP type (the caller then uploads the original).
 * A file the browser cannot decode throws.
 */
export async function encodeFigureWebp(
  file: File,
): Promise<EncodedImage | null> {
  if (typeof createImageBitmap !== "function") return null;
  // Phone photos carry their rotation in EXIF: apply it, so the figure is upright.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const size = figureTargetSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", FIGURE_WEBP_QUALITY),
    );
    // Free the canvas backing store now, not when it is collected (a 1920 px canvas is ~15 MB).
    canvas.width = 0;
    canvas.height = 0;
    if (!blob || blob.type !== "image/webp") return null;
    return { blob, ...size };
  } finally {
    bitmap.close();
  }
}

/** Natural size of an image URL, read by loading it. */
export function readImageSize(
  url: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = window.setTimeout(
      () => reject(new Error("Ảnh tải quá lâu.")),
      15_000,
    );
    img.onload = () => {
      window.clearTimeout(timer);
      if (img.naturalWidth > 0 && img.naturalHeight > 0)
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      else reject(new Error("Không đọc được kích thước ảnh."));
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("Không mở được ảnh."));
    };
    img.src = url;
  });
}
