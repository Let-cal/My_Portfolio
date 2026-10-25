import { beforeEach, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  read: vi.fn(),
  content: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/admin/session", () => ({ requireAdmin: m.auth }));
vi.mock("@/lib/admin/access", () => ({ requireContentRead: m.read }));
vi.mock("@/lib/admin/data", () => ({ getAdminContent: m.content }));
vi.mock("next/cache", () => ({ refresh: m.refresh }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    storage: {
      from: (bucket: string) => ({
        list: (...args: unknown[]) => m.list(bucket, ...args),
        remove: (...args: unknown[]) => m.remove(bucket, ...args),
      }),
    },
  }),
}));
import { listMedia, deleteMedia } from "@/app/admin/media-actions";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  m.auth.mockResolvedValue({ email: "admin@example.test" });
  m.read.mockResolvedValue({ kind: "admin", email: "admin@example.test" });
  m.content.mockResolvedValue(contentSchema.parse(seed));
  m.list.mockImplementation(async (bucket: string) => ({
    data:
      bucket === "media"
        ? [
            {
              name: "a.png",
              id: "a",
              metadata: { size: 50, mimetype: "image/png" },
            },
          ]
        : [],
    error: null,
  }));
  m.remove.mockResolvedValue({ data: [{ name: "a.png" }], error: null });
});
it("requires admin for listing and deletion and returns the common session error", async () => {
  // Listing uses the read gate, deletion the admin gate; both report an expired session.
  m.auth.mockRejectedValue(new Error("SESSION_EXPIRED"));
  m.read.mockRejectedValue(new Error("SESSION_EXPIRED"));
  expect(await listMedia()).toMatchObject({
    ok: false,
    code: "SESSION_EXPIRED",
  });
  expect(await deleteMedia("media", "a.png")).toMatchObject({
    ok: false,
    code: "SESSION_EXPIRED",
  });
  expect(m.list).not.toHaveBeenCalled();
  expect(m.remove).not.toHaveBeenCalled();
});
it("rechecks all hidden/current references before deleting and refuses a used file", async () => {
  const c = contentSchema.parse(seed);
  c.projects[0].published = false;
  c.projects[0].posterUrl =
    "https://project.supabase.co/storage/v1/object/public/media/a.png";
  m.content.mockResolvedValue(c);
  expect(await deleteMedia("media", "a.png")).toMatchObject({ ok: false });
  expect(m.remove).not.toHaveBeenCalled();
});
it("rechecks references after inventory traversal and before removal", async () => {
  const c = contentSchema.parse(seed);
  c.projects[0].published = false;
  c.projects[0].posterUrl =
    "https://project.supabase.co/storage/v1/object/public/media/a.png";
  m.content
    .mockResolvedValueOnce(contentSchema.parse(seed))
    .mockResolvedValueOnce(c);
  expect(await deleteMedia("media", "a.png")).toMatchObject({ ok: false });
  expect(m.content).toHaveBeenCalledTimes(2);
  expect(m.remove).not.toHaveBeenCalled();
});
it("refuses removal when the final content read fails or is incomplete", async () => {
  m.content
    .mockResolvedValueOnce(contentSchema.parse(seed))
    .mockResolvedValueOnce(null);
  expect(await deleteMedia("media", "a.png")).toMatchObject({ ok: false });
  expect(m.remove).not.toHaveBeenCalled();
});
it("removes exactly one confirmed unused Storage key through the session client", async () => {
  expect(await deleteMedia("media", "a.png")).toEqual({ ok: true });
  expect(m.remove).toHaveBeenCalledWith("media", ["a.png"]);
  expect(m.refresh).toHaveBeenCalled();
});
it("refuses out-of-scope, traversal, missing files and incomplete reference snapshots", async () => {
  expect(await deleteMedia("other", "a.png")).toMatchObject({ ok: false });
  expect(await deleteMedia("media", "../a.png")).toMatchObject({ ok: false });
  expect(await deleteMedia("media", "missing.png")).toMatchObject({
    ok: false,
  });
  m.content.mockResolvedValue(null);
  expect(await deleteMedia("media", "a.png")).toMatchObject({ ok: false });
  expect(m.remove).not.toHaveBeenCalled();
});

it("lets the read-only reviewer browse media but never delete it", async () => {
  m.auth.mockRejectedValue(new Error("FORBIDDEN"));
  m.read.mockResolvedValue({ kind: "reviewer", email: "r@example.test" });
  expect((await listMedia()).ok).toBe(true);
  const result = await deleteMedia("media", "a.png");
  expect(result.ok).toBe(false);
  expect(m.remove).not.toHaveBeenCalled();
});
