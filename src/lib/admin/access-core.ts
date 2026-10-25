// Pure access decision shared by the proxy (no server-only imports here) and server code.
import { isAdminEmail } from "./auth";

export type AdminAccess = { kind: "admin" | "reviewer"; email: string };

/**
 * Pure decision. The admin is the configured ADMIN_EMAIL, exactly as before; a reviewer is a
 * non-admin user whom the database lists in its private reviewer allowlist (`admin_access_kind`
 * answers "reviewer"). Editable user metadata is never consulted, and anything unexpected means
 * no access.
 */
export function resolveAccess(
  user: { email?: string | null } | null | undefined,
  databaseKind: unknown,
  adminEmail: string | null | undefined,
): AdminAccess | null {
  const email = user?.email?.trim();
  if (!email) return null;
  if (isAdminEmail(email, adminEmail)) return { kind: "admin", email };
  return databaseKind === "reviewer" ? { kind: "reviewer", email } : null;
}

export type AuthClient = {
  auth: {
    getUser(): Promise<{ data: { user: { email?: string | null } | null } }>;
  };
  rpc(fn: "admin_access_kind"): PromiseLike<{ data: unknown; error: unknown }>;
};

/** The signed-in user's admin access, asking the database only for non-admin users. */
export async function accessFor(
  supabase: AuthClient,
  adminEmail: string | null | undefined,
): Promise<{ access: AdminAccess | null; signedIn: boolean }> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) return { access: null, signedIn: false };
  if (isAdminEmail(user.email, adminEmail))
    return { access: resolveAccess(user, null, adminEmail), signedIn: true };
  const { data: kind, error } = await supabase.rpc("admin_access_kind");
  return {
    access: error ? null : resolveAccess(user, kind, adminEmail),
    signedIn: true,
  };
}
