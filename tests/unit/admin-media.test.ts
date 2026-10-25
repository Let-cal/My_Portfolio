import { expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import {
  storageKeyFromUrl,
  indexMediaUsage,
  collectMediaLibrary,
  canSelectMedia,
} from "@/lib/admin/media";
import type { SupabaseClient } from "@supabase/supabase-js";
const origin = "https://project.supabase.co";
const publicUrl = (bucket: string, path: string) =>
  `${origin}/storage/v1/object/public/${bucket}/${path}`;
it("canonicalizes only own public Storage URLs, including encoded names and transformations", () => {
  expect(
    storageKeyFromUrl(publicUrl("media", "image/a%20b.png") + "?v=1", origin),
  ).toBe("media/image/a b.png");
  expect(
    storageKeyFromUrl(
      origin + "/storage/v1/render/image/public/media/image/a.png?width=40",
      origin,
    ),
  ).toBe("media/image/a.png");
  expect(
    storageKeyFromUrl(
      "https://elsewhere.test/storage/v1/object/public/media/a.png",
      origin,
    ),
  ).toBeNull();
  expect(storageKeyFromUrl("/cv/builtin.pdf", origin)).toBeNull();
  expect(
    storageKeyFromUrl(publicUrl("other", "secret.pdf"), origin),
  ).toBeNull();
});
it("indexes hidden current content, nested strings and duplicate references without built-in assets", () => {
  const c = contentSchema.parse(seed);
  const url = publicUrl("media", "image/a.png");
  c.profile.avatarUrl = url;
  c.projects[0].published = false;
  c.projects[0].posterUrl = url;
  c.projects[0].summary.en = `Picture: [image](${url}?v=2)`;
  c.skills[0].name = url;
  const uses = indexMediaUsage(c, origin).get("media/image/a.png")!;
  expect(uses.some((u) => u.href === "/admin/profile")).toBe(true);
  expect(
    uses.filter((u) => u.href === `/admin/projects/${c.projects[0].id}`),
  ).toHaveLength(1);
  expect(indexMediaUsage(c, origin).has("files/cv/builtin.pdf")).toBe(false);
  expect(uses.some((u) => u.href === `/admin/skills/${c.skills[0].id}`)).toBe(
    true,
  );
});
it("walks nested folders and paginates completely; unknown metadata does not become zero bytes", async () => {
  const list = vi.fn(async (bucket: string, path: string, offset: number) => {
    if (bucket === "files") return { data: [], error: null };
    if (path === "")
      return {
        data: [{ name: "image", id: null, metadata: null }],
        error: null,
      };
    if (offset === 0)
      return {
        data: Array.from({ length: 100 }, (_, i) => ({
          name: `a${i}.png`,
          id: `id${i}`,
          metadata: { size: 2, mimetype: "image/png" },
          created_at: "2026-10-21",
        })),
        error: null,
      };
    return {
      data: [{ name: "unknown.png", id: "id100", metadata: null }],
      error: null,
    };
  });
  const client = {
    storage: {
      from: (bucket: string) => ({
        list: (path: string, options: { offset: number }) =>
          list(bucket, path, options.offset),
      }),
    },
  } as unknown as SupabaseClient;
  const snapshot = await collectMediaLibrary(
    client,
    contentSchema.parse(seed),
    origin,
  );
  expect(snapshot.files).toHaveLength(101);
  expect(snapshot.knownBytes).toBe(200);
  expect(snapshot.unknownSizes).toBe(1);
  expect(snapshot.files.find((f) => f.name === "unknown.png")?.size).toBeNull();
  expect(list).toHaveBeenCalledWith("media", "image", 100);
});
it("propagates a failed listing rather than presenting a partial inventory", async () => {
  const client = {
    storage: {
      from: () => ({
        list: async () => ({ data: null, error: { message: "denied" } }),
      }),
    },
  } as unknown as SupabaseClient;
  await expect(
    collectMediaLibrary(client, contentSchema.parse(seed), origin),
  ).rejects.toThrow("denied");
});
it("picker matches MIME and original upload size limits, and rejects unknown/oversized assets", () => {
  const base = { kind: "image" as const, mime: "image/png", size: 12 };
  expect(canSelectMedia(base, "image")).toBe(true);
  expect(canSelectMedia(base, "pdf")).toBe(false);
  expect(canSelectMedia({ ...base, size: null }, "image")).toBe(false);
  expect(canSelectMedia({ ...base, size: 6 * 1024 * 1024 }, "image")).toBe(
    false,
  );
});
