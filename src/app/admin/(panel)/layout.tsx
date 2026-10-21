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
import { buildCommandItems } from "@/lib/admin/command-items";
import { getAdminContent } from "@/lib/admin/data";
import { getAdminEmail } from "@/lib/admin/session";

async function SignedInAs() {
  const email = await getAdminEmail();
  return (
    <span className="hidden max-w-56 truncate text-sm text-muted-foreground sm:inline">
      {email}
    </span>
  );
}

/** The ⌘K palette needs every item's name; it degrades to an empty list if content fails. */
async function CommandLoader() {
  const content = await getAdminContent().catch(() => null);
  return <AdminCommand items={content ? buildCommandItems(content) : []} />;
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
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <ConnectionBanner />
        <header className="flex items-center justify-end gap-2">
          <Suspense fallback={<AdminCommand items={[]} />}>
            <CommandLoader />
          </Suspense>
          <span className="flex-1" />
          <Suspense>
            <SignedInAs />
          </Suspense>
          <AdminThemeToggle />
          <SignOutButton />
        </header>
        {children}
      </div>
      <SessionExpiredDialog />
      <AdminSessionSync />
      {/* Reads the current path (request data), so it renders inside Suspense. */}
      <Suspense>
        <RealtimeSync />
      </Suspense>
    </div>
  );
}
