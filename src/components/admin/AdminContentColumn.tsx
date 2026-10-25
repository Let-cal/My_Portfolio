import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminAccessProvider } from "@/components/admin/AdminAccessProvider";
import { AdminCommand } from "@/components/admin/AdminCommand";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import { ConnectionBanner } from "@/components/admin/ConnectionBanner";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { Badge } from "@/components/ui/badge";
import { getAdminAccess, type AdminAccess } from "@/lib/admin/access";
import { buildCommandItems } from "@/lib/admin/command-items";
import { getAdminContent } from "@/lib/admin/data";

export const ADMIN_COLUMN = "flex min-w-0 flex-1 flex-col gap-6";

function SignedInAs({ access }: { access: AdminAccess }) {
  return (
    <span className="hidden max-w-56 items-center gap-2 text-sm text-muted-foreground sm:flex">
      <span className="truncate">{access.email}</span>
      {access.kind === "reviewer" && <Badge variant="outline">Chỉ đọc</Badge>}
    </span>
  );
}

/** The ⌘K palette needs every item's name; it degrades to an empty list if content fails. */
async function CommandLoader({ readOnly }: { readOnly: boolean }) {
  const content = await getAdminContent().catch(() => null);
  return (
    <AdminCommand
      items={content ? buildCommandItems(content, { readOnly }) : []}
    />
  );
}

/**
 * The content column, once the session says who is looking (reads cookies, so inside Suspense).
 * The reviewer gets the read-only screens; anyone else goes to the login page (the proxy normally
 * sends them there first). The server refuses non-admin writes either way.
 */
export async function AdminContentColumn({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getAdminAccess();
  if (!access) redirect("/admin/login");
  const readOnly = access.kind !== "admin";
  return (
    <AdminAccessProvider kind={access.kind}>
      <div className={ADMIN_COLUMN}>
        {readOnly && <ReadOnlyNotice />}
        <ConnectionBanner />
        <header className="flex items-center justify-end gap-2">
          <Suspense fallback={<AdminCommand items={[]} />}>
            <CommandLoader readOnly={readOnly} />
          </Suspense>
          <span className="flex-1" />
          <SignedInAs access={access} />
          <AdminThemeToggle />
          <SignOutButton />
        </header>
        {children}
      </div>
    </AdminAccessProvider>
  );
}
