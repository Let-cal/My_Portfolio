import { Suspense } from "react";
import { AdminCommand } from "@/components/admin/AdminCommand";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import { HealthBadge } from "@/components/admin/HealthBadge";
import { ConnectionBanner } from "@/components/admin/ConnectionBanner";
import { RealtimeSync } from "@/components/admin/RealtimeSync";
import { SessionExpiredDialog } from "@/components/admin/SessionExpiredDialog";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { AdminSessionSync } from "@/components/admin/AdminSessionSync";
import { AdminAccessProvider } from "@/components/admin/AdminAccessProvider";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { Badge } from "@/components/ui/badge";
import { getAdminAccess, type AdminAccess } from "@/lib/admin/access";
import { buildCommandItems } from "@/lib/admin/command-items";
import { getAdminContent } from "@/lib/admin/data";

const COLUMN = "flex min-w-0 flex-1 flex-col gap-6";

function SignedInAs({ access }: { access: AdminAccess | null }) {
  return (
    <span className="hidden max-w-56 items-center gap-2 text-sm text-muted-foreground sm:flex">
      <span className="truncate">{access?.email}</span>
      {access?.kind === "reviewer" && <Badge variant="outline">Chỉ đọc</Badge>}
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
 * Anyone but the admin gets the read-only screens; the server refuses their writes either way.
 */
async function ContentColumn({ children }: { children: React.ReactNode }) {
  const access = await getAdminAccess();
  const readOnly = access?.kind !== "admin";
  return (
    <AdminAccessProvider kind={readOnly ? "reviewer" : "admin"}>
      <div className={COLUMN}>
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

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row md:gap-8">
      <AdminSidebar
        badge={
          <Suspense>
            <HealthBadge />
          </Suspense>
        }
      />
      <Suspense fallback={<div className={COLUMN} aria-busy />}>
        <ContentColumn>{children}</ContentColumn>
      </Suspense>
      <SessionExpiredDialog />
      <AdminSessionSync />
      {/* Reads the current path (request data), so it renders inside Suspense. */}
      <Suspense>
        <RealtimeSync />
      </Suspense>
    </div>
  );
}
