import { afterEach, describe, expect, it, vi } from "vitest";
import { contentSchema } from "@/content/schema";
import seed from "@/content/seed.json";
import { loadContent, loadContentWithSource } from "@/lib/data/get-content";
import type { ContentRepository } from "@/lib/data/repository";

const seedContent = contentSchema.parse(seed);
const withUrl = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadContent", () => {
  it("uses the seed when Supabase is not configured", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await loadContent({})).toEqual(seedContent);
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to the seed and warns once when the repository throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing: ContentRepository = {
      getContent: async () => {
        throw new Error("paused");
      },
    };
    const result = await loadContent(withUrl, () => failing);
    expect(result).toEqual(seedContent);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("falls back to the seed and warns when the repository returns invalid data", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const invalid = {
      getContent: async () => ({ nope: true }),
    } as unknown as ContentRepository;
    const result = await loadContent(withUrl, () => invalid);
    expect(result).toEqual(seedContent);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("falls back to the seed when the repository factory itself throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await loadContent(withUrl, () => {
      throw new Error("missing anon key");
    });
    expect(result).toEqual(seedContent);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("returns the repository data when it is valid", async () => {
    const custom = { ...seedContent, whyCards: [] };
    const repo: ContentRepository = { getContent: async () => custom };
    const result = await loadContent(withUrl, () => repo);
    expect(result.whyCards).toEqual([]);
  });
});

describe("loadContentWithSource", () => {
  it("reports seed-unconfigured without a Supabase URL", async () => {
    const r = await loadContentWithSource({});
    expect(r.source).toBe("seed-unconfigured");
    expect(r.content).toEqual(seedContent);
  });

  it("reports seed-fallback when the repository throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing: ContentRepository = {
      getContent: async () => {
        throw new Error("paused");
      },
    };
    expect((await loadContentWithSource(withUrl, () => failing)).source).toBe(
      "seed-fallback",
    );
  });

  it("reports seed-fallback when the repository returns invalid data", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const invalid = {
      getContent: async () => ({ nope: true }),
    } as unknown as ContentRepository;
    expect((await loadContentWithSource(withUrl, () => invalid)).source).toBe(
      "seed-fallback",
    );
  });

  it("reports supabase when the repository returns valid data", async () => {
    const repo: ContentRepository = { getContent: async () => seedContent };
    expect((await loadContentWithSource(withUrl, () => repo)).source).toBe(
      "supabase",
    );
  });
});
