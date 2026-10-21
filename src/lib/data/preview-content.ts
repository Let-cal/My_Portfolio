import { cache } from "react";
import { draftMode } from "next/headers";
import { contentSchema } from "@/content/schema";
import { requireAdmin } from "@/lib/admin/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { SupabaseRepository } from "./supabase-repository";
// React.cache is request scoped. Session cookies/admin data never enter use-cache.
export const getPreviewContent = cache(async () => {
  if (!(await draftMode()).isEnabled) return null;
  try {
    await requireAdmin();
  } catch (error) {
    if (
      error instanceof Error &&
      ["SESSION_EXPIRED", "FORBIDDEN"].includes(error.message)
    )
      return null;
    throw error;
  }
  const content = contentSchema.parse(
    await new SupabaseRepository(await createServerSupabase()).getContent(),
  );
  // Public renderers intentionally filter published rows. This request-local view admits all
  // saved rows without mutating storage, the original models or the anonymous cache.
  return {
    ...content,
    experiences: content.experiences.map((row) => ({
      ...row,
      published: true,
    })),
    projects: content.projects.map((row) => ({ ...row, published: true })),
    certificates: content.certificates.map((row) => ({
      ...row,
      published: true,
    })),
  };
});
