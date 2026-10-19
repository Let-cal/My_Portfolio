import { Suspense } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import { HealthBadge } from "@/components/admin/HealthBadge";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { getAdminEmail } from "@/lib/admin/session";

async function SignedInAs() {
  const email = await getAdminEmail();
  return (
    <span className="hidden max-w-56 truncate text-sm text-muted-foreground sm:inline">
      {email}
    </span>
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
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <header className="flex items-center justify-end gap-2">
          <Suspense>
            <SignedInAs />
          </Suspense>
          <AdminThemeToggle />
          <SignOutButton />
        </header>
        {children}
      </div>
    </div>
  );
}
