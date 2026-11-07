// Image figures are uploaded as WebP at most 1920 px wide and served at that one size (spec 6.2). The browser
// encodes the file before upload (figures-client.ts); this module holds the pure parts, the target size and
// which file goes up, so they are tested without a canvas.
import { validateUpload } from "./upload";

export const FIGURE_MAX_WIDTH = 1920;
export const FIGURE_WEBP_QUALITY = 0.82;
/** Originals above this are refused before decoding: a huge file can exhaust the tab's memory while it decodes. */
export const FIGURE_MAX_INPUT_BYTES = 30 * 1024 * 1024;

export type ImageSize = { width: number; height: number };

/** The size to encode at: at most `max` px wide, aspect ratio kept, never upscaled. */
export function figureTargetSize(
  width: number,
  height: number,
  max = FIGURE_MAX_WIDTH,
): ImageSize {
  if (!(width > 0 && height > 0) || !isFinite(width) || !isFinite(height))
    throw new Error("Không đọc được kích thước ảnh.");
  if (width <= max) return { width, height };
  return {
    width: max,
    height: Math.max(1, Math.round((height * max) / width)),
  };
}

export type EncodedImage = ImageSize & { blob: Blob };

/** Encodes an image file as WebP at the target size; null when this browser cannot encode WebP. */
export type EncodeFigureImage = (file: File) => Promise<EncodedImage | null>;

export type PreparedImage =
  | { ok: true; file: File; size: ImageSize | null }
  | { ok: false; reason: string };

function webpName(name: string): string {
  const dot = name.lastIndexOf(".");
  return `${dot > 0 ? name.slice(0, dot) : name || "image"}.webp`;
}

/**
 * The file to upload: the WebP encoding with its size when there is one, else the original (its size is read
 * after upload). Either way the 5 MB image limit applies to what is uploaded.
 */
export function chooseFigureUpload(
  original: File,
  encoded: EncodedImage | null,
): PreparedImage {
  if (encoded && encoded.blob.type === "image/webp") {
    const file = new File([encoded.blob], webpName(original.name), {
      type: "image/webp",
    });
    const check = validateUpload(file, "image");
    if (!check.ok) return check;
    return {
      ok: true,
      file,
      size: { width: encoded.width, height: encoded.height },
    };
  }
  const check = validateUpload(original, "image");
  if (!check.ok) return check;
  return { ok: true, file: original, size: null };
}

/**
 * Checks the type, encodes, and picks the file to upload. The size limit is checked on the result, so a large
 * photo that encodes small is accepted. An encoder error (a format this browser cannot decode) falls back to
 * the original, which then has to pass the limit on its own.
 */
export async function prepareFigureImage(
  file: File,
  encode: EncodeFigureImage,
): Promise<PreparedImage> {
  // The type only: the size is checked on what is uploaded.
  const typeCheck = validateUpload({ type: file.type, size: 1 }, "image");
  if (!typeCheck.ok) return typeCheck;
  if (file.size > FIGURE_MAX_INPUT_BYTES)
    return {
      ok: false,
      reason: "Ảnh gốc lớn hơn 30 MB, hãy thu nhỏ trước khi tải lên.",
    };
  let encoded: EncodedImage | null = null;
  try {
    encoded = await encode(file);
  } catch {
    encoded = null;
  }
  return chooseFigureUpload(file, encoded);
}
