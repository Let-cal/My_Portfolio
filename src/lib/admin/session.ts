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

/** Call first in every admin server action. Row level security still checks each write. */
export async function requireAdmin(): Promise<{ email: string }> {
  const email = await getAdminEmail();
  if (!email) throw new Error("FORBIDDEN");
  return { email };
}
