import { createServerSupabase } from "@/lib/supabase/server";
import { isAdminEmail, isSupabaseConfigured } from "./auth";

/** The signed-in admin's email, or null. Reads the request cookies, so call it inside <Suspense>. */
export async function getAdminEmail(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? null;
  return isAdminEmail(email, process.env.ADMIN_EMAIL) ? email : null;
}

/**
 * Call first in every admin server action. Row level security still checks each write.
 * Throws SESSION_EXPIRED when nobody is signed in (the client offers to sign in again and keeps
 * the form) and FORBIDDEN for a signed-in user who is not the admin.
 */
export async function requireAdmin(): Promise<{ email: string }> {
  if (!isSupabaseConfigured()) throw new Error("FORBIDDEN");
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? null;
  if (!email) throw new Error("SESSION_EXPIRED");
  if (!isAdminEmail(email, process.env.ADMIN_EMAIL))
    throw new Error("FORBIDDEN");
  return { email };
}
