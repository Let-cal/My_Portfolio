// Pure helpers shared by the proxy guard, the login page and server actions.

export function isAdminEmail(email: string | null | undefined, adminEmail: string | null | undefined): boolean {
  const a = email?.trim().toLowerCase();
  const b = adminEmail?.trim().toLowerCase();
  return Boolean(a && b && a === b);
}

/** Where to go after signing in. Only admin paths are allowed, so `next` cannot send anyone off-site. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !/^\/admin(\/[\w-]*)*$/.test(next)) return "/admin";
  return next;
}

export function isSupabaseConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
