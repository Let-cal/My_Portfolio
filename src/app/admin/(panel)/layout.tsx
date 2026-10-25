import { Suspense } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { HealthBadge } from "@/components/admin/HealthBadge";
import { RealtimeSync } from "@/components/admin/RealtimeSync";
import { SessionExpiredDialog } from "@/components/admin/SessionExpiredDialog";
import { AdminSessionSync } from "@/components/admin/AdminSessionSync";
import {
  ADMIN_COLUMN,
  AdminContentColumn,
} from "@/components/admin/AdminContentColumn";

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
      <Suspense fallback={<div className={ADMIN_COLUMN} aria-busy />}>
        <AdminContentColumn>{children}</AdminContentColumn>
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
