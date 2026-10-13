import { cacheLife, cacheTag } from "next/cache";
import { contentSchema, type Content } from "@/content/schema";
import type { ContentRepository } from "./repository";
import { SeedRepository } from "./seed-repository";
import { createPublicSupabase, SupabaseRepository } from "./supabase-repository";

type Env = Record<string, string | undefined>;
export type RepoFactory = (env: Env) => ContentRepository;

const defaultRepoFactory: RepoFactory = (env) => new SupabaseRepository(createPublicSupabase(env));

/**
 * Supabase when `NEXT_PUBLIC_SUPABASE_URL` is set, otherwise the seed.
 * If Supabase throws or returns data that fails `contentSchema`, warn once and use the seed.
 */
export async function loadContent(
  env: Env = process.env,
  repoFactory: RepoFactory = defaultRepoFactory,
): Promise<Content> {
  if (!env.NEXT_PUBLIC_SUPABASE_URL) return new SeedRepository().getContent();
  try {
    const raw = await repoFactory(env).getContent();
    const parsed = contentSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`invalid content: ${parsed.error.message}`);
    return parsed.data;
  } catch (err) {
    console.warn("[content] Supabase unavailable, using seed:", err instanceof Error ? err.message : err);
    return new SeedRepository().getContent();
  }
}

/** Cached site content. Admin writes call `updateTag('content')` to refresh it. */
export async function getContent(): Promise<Content> {
  "use cache";
  cacheTag("content");
  cacheLife("max");
  return loadContent();
}
