import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS: use it only in scripts and on the server, never in client code.
 */
export function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
