import { beforeEach, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
const mocks = vi.hoisted(() => ({
  enabled: false,
  enable: vi.fn(),
  disable: vi.fn(),
  require: vi.fn(),
  read: vi.fn(),
  client: vi.fn(() => ({})),
  tag: vi.fn(),
  life: vi.fn(),
}));
vi.mock("next/headers", () => ({
  draftMode: async () => ({
    isEnabled: mocks.enabled,
    enable: mocks.enable,
    disable: mocks.disable,
  }),
}));
vi.mock("next/cache", () => ({ cacheTag: mocks.tag, cacheLife: mocks.life }));
vi.mock("@/lib/admin/session", () => ({ requireAdmin: mocks.require }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: mocks.client,
}));
vi.mock("@/lib/data/supabase-repository", () => ({
  createPublicSupabase: () => ({}),
  SupabaseRepository: class {
    getContent = mocks.read;
  },
}));
const content = contentSchema.parse(seed);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled = false;
  mocks.require.mockResolvedValue({ email: "admin@example.test" });
  mocks.read.mockResolvedValue(content);
});
it("validates preview destinations without accepting an external redirect", async () => {
  const { previewDestination } = await import("@/lib/admin/preview");
  expect(
    previewDestination(new URLSearchParams("locale=ja&target=skills")),
  ).toBe("/ja#skills");
  expect(() =>
    previewDestination(new URLSearchParams("locale=https://evil.test")),
  ).toThrow();
  expect(() =>
    previewDestination(new URLSearchParams("target=//evil.test")),
  ).toThrow();
});
it("enables draft mode only for a validated admin request", async () => {
  const { GET } = await import("@/app/admin/preview/route");
  const response = await GET(
    new Request("https://site.test/admin/preview?locale=vi&target=skills"),
  );
  expect(mocks.require).toHaveBeenCalled();
  expect(mocks.enable).toHaveBeenCalledOnce();
  expect(response.headers.get("location")).toBe("/vi#skills");
  expect(response.headers.get("cache-control")).toContain("no-store");
  mocks.require.mockRejectedValue(new Error("SESSION_EXPIRED"));
  mocks.enable.mockClear();
  expect(
    (await GET(new Request("https://site.test/admin/preview"))).status,
  ).toBe(401);
  expect(mocks.enable).not.toHaveBeenCalled();
});
it("rejects invalid destinations before enabling and rejects cross-origin exit", async () => {
  const { GET } = await import("@/app/admin/preview/route");
  expect(
    (await GET(new Request("https://site.test/admin/preview?locale=xx")))
      .status,
  ).toBe(400);
  expect(mocks.enable).not.toHaveBeenCalled();
  const { POST } = await import("@/app/api/preview/exit/route");
  expect(
    (
      await POST(
        new Request("https://site.test/api/preview/exit", {
          method: "POST",
          headers: { origin: "https://evil.test" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(mocks.disable).not.toHaveBeenCalled();
  const response = await POST(
    new Request("https://site.test/api/preview/exit?locale=ja&target=skills", {
      method: "POST",
      headers: { origin: "https://site.test" },
    }),
  );
  expect(mocks.disable).toHaveBeenCalledOnce();
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("/ja#skills");
});
it("validates the browser host behind a reverse proxy without redirecting to the internal URL", async () => {
  const { POST } = await import("@/app/api/preview/exit/route");
  const response = await POST(
    new Request("http://internal:3000/api/preview/exit?locale=ja", {
      method: "POST",
      headers: {
        host: "site.test",
        origin: "https://site.test",
        "x-forwarded-proto": "https",
      },
    }),
  );
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("/ja#hero");
});
it("reads hidden preview content only through the authorized session and outside public cache", async () => {
  mocks.enabled = true;
  const { getContent } = await import("@/lib/data/get-content");
  expect(await getContent()).toEqual(content);
  expect(mocks.require).toHaveBeenCalled();
  expect(mocks.client).toHaveBeenCalled();
  expect(mocks.tag).not.toHaveBeenCalled();
  expect(mocks.life).not.toHaveBeenCalled();
});
it("a draft cookie with no authorized admin cannot request hidden data", async () => {
  mocks.enabled = true;
  mocks.require.mockRejectedValue(new Error("FORBIDDEN"));
  const { getContent } = await import("@/lib/data/get-content");
  await getContent();
  expect(mocks.client).not.toHaveBeenCalled();
  expect(mocks.tag).toHaveBeenCalledWith("content");
});
it("preview read errors do not silently substitute the seed or public cache", async () => {
  mocks.enabled = true;
  mocks.read.mockRejectedValue(new Error("preview unavailable"));
  const { getContent } = await import("@/lib/data/get-content");
  await expect(getContent()).rejects.toThrow("preview unavailable");
  expect(mocks.tag).not.toHaveBeenCalled();
});
it("renders hidden saved rows through a cloned view without publishing the stored objects", async () => {
  mocks.enabled = true;
  const stored = structuredClone(content);
  stored.experiences[0].published = false;
  stored.projects[0].published = false;
  stored.certificates[0].published = false;
  mocks.read.mockResolvedValue(stored);
  const { getContent } = await import("@/lib/data/get-content");
  const preview = await getContent();
  expect(preview.experiences[0].published).toBe(true);
  expect(preview.projects[0].published).toBe(true);
  expect(preview.certificates[0].published).toBe(true);
  expect(stored.experiences[0].published).toBe(false);
  expect(stored.projects[0].published).toBe(false);
  expect(stored.certificates[0].published).toBe(false);
  const { orderExperiences } = await import("@/lib/roles");
  expect(
    orderExperiences(preview.experiences, preview.roles[0]).some(
      (row) => row.id === stored.experiences[0].id,
    ),
  ).toBe(true);
});
