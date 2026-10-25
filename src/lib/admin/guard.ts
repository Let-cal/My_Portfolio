import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { accessFor } from "./access-core";
import { isSupabaseConfigured } from "./auth";

type Env = Record<string, string | undefined>;

/**
 * Guards `/admin*` in the proxy: refreshes the Supabase session cookie and sends anyone who is
 * neither the configured admin nor the read-only reviewer to the login page. This is the first
 * line only: server actions check again, and row level security rejects every write from anyone
 * missing from private.app_admins.
 */
export async function adminGuard(
  request: NextRequest,
  env: Env = process.env,
): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const toLogin = () => {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  };
  if (!isSupabaseConfigured(env)) return toLogin();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies) {
          for (const { name, value } of cookies)
            request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookies)
            response.cookies.set(name, value, options);
        },
      },
    },
  );

  // Server actions (POST with a Next-Action header) are not redirected: a redirect would replace
  // the page and lose the form. requireAdmin() answers them (SESSION_EXPIRED / FORBIDDEN) and
  // row level security still rejects every write from a non-admin.
  if (request.method === "POST" && request.headers.has("next-action")) {
    // Still refresh the session cookie for the action that follows.
    await supabase.auth.getUser();
    return response;
  }
  // The admin, or the read-only reviewer (listed in the database's private allowlist).
  const { access } = await accessFor(supabase, env.ADMIN_EMAIL);
  if (!access) return toLogin();
  return response;
}
