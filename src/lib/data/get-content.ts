import { cacheLife, cacheTag } from "next/cache";
import { contentSchema, type Content } from "@/content/schema";
import type { ContentRepository } from "./repository";
import { SeedRepository } from "./seed-repository";
import {
  createPublicSupabase,
  SupabaseRepository,
} from "./supabase-repository";

type Env = Record<string, string | undefined>;
export type RepoFactory = (env: Env) => ContentRepository;

const defaultRepoFactory: RepoFactory = (env) =>
  new SupabaseRepository(createPublicSupabase(env));

export type ContentSource = "supabase" | "seed-unconfigured" | "seed-fallback";

/**
 * Supabase when `NEXT_PUBLIC_SUPABASE_URL` is set, otherwise the seed.
 * If Supabase throws or returns data that fails `contentSchema`, warn once and use the seed.
 * `source` tells callers which of the three happened.
 */
export async function loadContentWithSource(
  env: Env = process.env,
  repoFactory: RepoFactory = defaultRepoFactory,
): Promise<{ content: Content; source: ContentSource }> {
  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    return {
      content: await new SeedRepository().getContent(),
      source: "seed-unconfigured",
    };
  }
  try {
    const raw = await repoFactory(env).getContent();
    const parsed = contentSchema.safeParse(raw);
    if (!parsed.success)
      throw new Error(`invalid content: ${parsed.error.message}`);
    return { content: parsed.data, source: "supabase" };
  } catch (err) {
    console.warn(
      "[content] Supabase unavailable, using seed:",
      err instanceof Error ? err.message : err,
    );
    return {
      content: await new SeedRepository().getContent(),
      source: "seed-fallback",
    };
  }
}

export async function loadContent(
  env: Env = process.env,
  repoFactory: RepoFactory = defaultRepoFactory,
): Promise<Content> {
  return (await loadContentWithSource(env, repoFactory)).content;
}

/**
 * Cached site content. Admin writes call `updateTag('content')` to refresh it.
 * A seed fallback (Supabase configured but failing) is cached for minutes only, so the site
 * recovers after Supabase resumes; every other result is cached for the max lifetime.
 */
export async function getContent(): Promise<Content> {
  "use cache";
  cacheTag("content");
  const { content, source } = await loadContentWithSource();
  if (source === "seed-fallback") cacheLife("minutes");
  else cacheLife("max");
  return content;
}
