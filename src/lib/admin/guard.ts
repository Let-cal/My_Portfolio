import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail, isSupabaseConfigured } from "./auth";

type Env = Record<string, string | undefined>;

/**
 * Guards `/admin*` in the proxy: refreshes the Supabase session cookie and sends anyone who is
 * not the configured admin to the login page. This is the first line only; row level security
 * in the database rejects writes from anyone missing from private.app_admins.
 */
export async function adminGuard(request: NextRequest, env: Env = process.env): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const toLogin = () => {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  };
  if (!isSupabaseConfigured(env)) return toLogin();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        for (const { name, value } of cookies) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (!isAdminEmail(data.user?.email, env.ADMIN_EMAIL)) return toLogin();
  return response;
}
