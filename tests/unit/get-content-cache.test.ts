import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";

const cacheLife = vi.fn();
const cacheTag = vi.fn();
vi.mock("next/cache", () => ({ cacheLife, cacheTag }));
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: false }),
}));

const repoGetContent = vi.fn();
vi.mock("@/lib/data/supabase-repository", () => ({
  createPublicSupabase: () => ({}),
  SupabaseRepository: class {
    getContent = repoGetContent;
  },
}));

const seedContent = contentSchema.parse(seed);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  cacheLife.mockClear();
  cacheTag.mockClear();
  repoGetContent.mockReset();
});

describe("getContent cache lifetime", () => {
  it("tags the cache entry and uses 'max' when Supabase answers", async () => {
    repoGetContent.mockResolvedValue(seedContent);
    const { getContent } = await import("@/lib/data/get-content");
    await getContent();
    expect(cacheTag).toHaveBeenCalledWith("content");
    expect(cacheLife).toHaveBeenCalledTimes(1);
    expect(cacheLife).toHaveBeenCalledWith("max");
  });

  it("uses 'minutes' when it fell back to the seed", async () => {
    repoGetContent.mockRejectedValue(new Error("paused"));
    const { getContent } = await import("@/lib/data/get-content");
    const result = await getContent();
    expect(result).toEqual(seedContent);
    expect(cacheLife).toHaveBeenCalledTimes(1);
    expect(cacheLife).toHaveBeenCalledWith("minutes");
  });

  it("uses 'max' when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const { getContent } = await import("@/lib/data/get-content");
    await getContent();
    expect(cacheLife).toHaveBeenCalledTimes(1);
    expect(cacheLife).toHaveBeenCalledWith("max");
  });
});
