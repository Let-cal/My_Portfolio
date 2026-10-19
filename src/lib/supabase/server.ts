import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

/** Cookie-based client for server components, route handlers and server actions (admin session). */
export async function createServerSupabase() {
  // Session reads are request-time only; never let them run while Next prerenders a shell
  // (the auth client checks token expiry with Date.now()).
  await connection();
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, which cannot set cookies. proxy.ts refreshes the session.
          }
        },
      },
    },
  );
}
