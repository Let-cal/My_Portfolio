import { describe, expect, it, vi } from "vitest";
import {
  FIGURE_MAX_WIDTH,
  chooseFigureUpload,
  figureTargetSize,
  prepareFigureImage,
  type EncodedImage,
} from "@/lib/admin/figure-image";

const MB = 1024 * 1024;

function file(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}
function webp(width: number, height: number, size = 200_000): EncodedImage {
  return {
    blob: new Blob([new Uint8Array(size)], { type: "image/webp" }),
    width,
    height,
  };
}

describe("figureTargetSize (spec 6.2: WebP at most 1920 px wide)", () => {
  it("is 1920 px", () => {
    expect(FIGURE_MAX_WIDTH).toBe(1920);
  });
  it("scales a wider image down to 1920 px, keeping the aspect ratio", () => {
    expect(figureTargetSize(3840, 2160)).toEqual({ width: 1920, height: 1080 });
    expect(figureTargetSize(2560, 1600)).toEqual({ width: 1920, height: 1200 });
    // Rounded to whole pixels.
    expect(figureTargetSize(4000, 3001)).toEqual({ width: 1920, height: 1440 });
  });
  it("never upscales", () => {
    expect(figureTargetSize(1920, 1080)).toEqual({ width: 1920, height: 1080 });
    expect(figureTargetSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(figureTargetSize(390, 2532)).toEqual({ width: 390, height: 2532 });
  });
  it("keeps at least one pixel of height for an extreme panorama", () => {
    expect(figureTargetSize(100_000, 10)).toEqual({ width: 1920, height: 1 });
  });
  it("refuses an image without a size", () => {
    expect(() => figureTargetSize(0, 100)).toThrow();
    expect(() => figureTargetSize(100, Number.NaN)).toThrow();
  });
});

describe("chooseFigureUpload", () => {
  it("uploads the WebP encoding with its size and a .webp name", () => {
    const result = chooseFigureUpload(
      file("Màn hình chính.png", "image/png", 7 * MB),
      webp(1920, 1080),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.type).toBe("image/webp");
    expect(result.file.name).toBe("Màn hình chính.webp");
    expect(result.file.size).toBe(200_000);
    expect(result.size).toEqual({ width: 1920, height: 1080 });
  });
  it("falls back to the original when the browser cannot encode WebP", () => {
    const original = file("shot.png", "image/png", 2 * MB);
    const result = chooseFigureUpload(original, null);
    expect(result).toEqual({ ok: true, file: original, size: null });
  });
  it("treats a non-WebP blob (an encoder that ignored the type) as no encoding", () => {
    const original = file("shot.jpg", "image/jpeg", 1 * MB);
    const result = chooseFigureUpload(original, {
      blob: new Blob([new Uint8Array(10)], { type: "image/png" }),
      width: 10,
      height: 10,
    });
    expect(result).toEqual({ ok: true, file: original, size: null });
  });
  it("refuses an original over 5 MB on the fallback, with the usual message", () => {
    const result = chooseFigureUpload(
      file("big.png", "image/png", 5 * MB + 1),
      null,
    );
    expect(result).toEqual({ ok: false, reason: "Tệp lớn hơn 5 MB." });
  });
  it("refuses an encoding that is still over 5 MB", () => {
    const result = chooseFigureUpload(
      file("big.png", "image/png", 20 * MB),
      webp(1920, 1080, 5 * MB + 1),
    );
    expect(result).toEqual({ ok: false, reason: "Tệp lớn hơn 5 MB." });
  });
});

describe("prepareFigureImage", () => {
  it("encodes a large image instead of refusing it", async () => {
    const encode = vi.fn(async () => webp(1920, 1200));
    const original = file("huge.png", "image/png", 12 * MB);
    const result = await prepareFigureImage(original, encode);
    expect(encode).toHaveBeenCalledWith(original);
    expect(result.ok && result.file.type).toBe("image/webp");
  });
  it("refuses a type that is not an image upload before encoding", async () => {
    const encode = vi.fn(async () => webp(10, 10));
    const result = await prepareFigureImage(
      file("anim.gif", "image/gif", 1000),
      encode,
    );
    expect(result.ok).toBe(false);
    expect(encode).not.toHaveBeenCalled();
  });
  it("falls back to the original when the encoder fails", async () => {
    const original = file("odd.avif", "image/avif", 1 * MB);
    const result = await prepareFigureImage(original, async () => {
      throw new Error("decode failed");
    });
    expect(result).toEqual({ ok: true, file: original, size: null });
  });
});
