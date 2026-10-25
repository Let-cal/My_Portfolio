// Who may open the admin: the admin (full rights) or the read-only reviewer. One resolver for the
// proxy, layouts and server actions, so every gate answers the same way.
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./auth";

export {
  accessFor,
  resolveAccess,
  type AdminAccess,
  type AuthClient,
} from "./access-core";
import { accessFor, type AdminAccess, type AuthClient } from "./access-core";

/** Reads the request cookies, so call it inside <Suspense>. */
export async function getAdminAccess(): Promise<AdminAccess | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabase();
  return (
    await accessFor(supabase as unknown as AuthClient, process.env.ADMIN_EMAIL)
  ).access;
}

/**
 * For server actions that only read admin data (history, media listing, session checks).
 * Writes keep requireAdmin(): the reviewer can read everything and change nothing.
 */
export async function requireContentRead(): Promise<AdminAccess> {
  if (!isSupabaseConfigured()) throw new Error("FORBIDDEN");
  const supabase = await createServerSupabase();
  const { access, signedIn } = await accessFor(
    supabase as unknown as AuthClient,
    process.env.ADMIN_EMAIL,
  );
  if (!signedIn) throw new Error("SESSION_EXPIRED");
  if (!access) throw new Error("FORBIDDEN");
  return access;
}
