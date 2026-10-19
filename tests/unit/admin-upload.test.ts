import { describe, expect, it } from "vitest";
import { bucketFor, storagePath, validateUpload } from "@/lib/admin/upload";

const MB = 1024 * 1024;

describe("validateUpload", () => {
  it("rejects a 9 MB video", () => {
    expect(
      validateUpload({ size: 9 * MB, type: "video/mp4" }, "video").ok,
    ).toBe(false);
  });
  it("rejects a GIF image", () => {
    const result = validateUpload({ size: 1 * MB, type: "image/gif" }, "image");
    expect(result).toEqual({
      ok: false,
      reason: expect.stringContaining("image/gif"),
    });
  });
  it("accepts a 1 MB PDF", () => {
    expect(
      validateUpload({ size: 1 * MB, type: "application/pdf" }, "pdf"),
    ).toEqual({ ok: true });
  });
  it("accepts each size limit exactly and rejects one byte more", () => {
    expect(
      validateUpload({ size: 5 * MB, type: "image/webp" }, "image").ok,
    ).toBe(true);
    expect(
      validateUpload({ size: 5 * MB + 1, type: "image/webp" }, "image").ok,
    ).toBe(false);
    expect(
      validateUpload({ size: 10 * MB, type: "application/pdf" }, "pdf").ok,
    ).toBe(true);
  });
  it("rejects empty files", () => {
    expect(validateUpload({ size: 0, type: "application/pdf" }, "pdf").ok).toBe(
      false,
    );
  });
});

describe("storage location", () => {
  it("keeps media and documents in separate public buckets", () => {
    expect(bucketFor("image")).toBe("media");
    expect(bucketFor("video")).toBe("media");
    expect(bucketFor("pdf")).toBe("files");
  });
  it("builds a unique, URL-safe path that keeps the extension", () => {
    const path = storagePath("pdf", "CV Lê Trần (2026).PDF", "abc123");
    expect(path).toBe("pdf/abc123-cv-le-tran-2026.pdf");
  });
});
