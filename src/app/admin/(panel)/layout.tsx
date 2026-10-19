import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { RESOURCE_KEYS, resources } from "@/lib/admin/resources";
import { getAdminContent } from "@/lib/admin/data";
import { checkContentHealth } from "@/lib/admin/health";
import { getAdminEmail } from "@/lib/admin/session";

async function SignedInAs() {
  const email = await getAdminEmail();
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="hidden sm:inline">{email}</span>
      <SignOutButton />
    </div>
  );
}

/** Count of errors and warnings, shown next to "Tổng quan". */
async function HealthBadge() {
  const count = checkContentHealth(await getAdminContent()).filter((i) => i.severity !== "info").length;
  if (!count) return null;
  return (
    <span className="ml-auto rounded-full bg-amber-500/20 px-1.5 text-xs font-medium tabular-nums" aria-label={`${count} mục cần chú ý`}>
      {count}
    </span>
  );
}

const NAV = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/profile", label: "Hồ sơ" },
  { href: "/admin/roles", label: "Vai trò & CV" },
  ...RESOURCE_KEYS.map((key) => ({ href: `/admin/${key}`, label: resources[key].label })),
];

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
      <nav aria-label="Quản trị" className="flex shrink-0 flex-col gap-4 md:w-48">
        <Link href="/admin" className="text-lg font-semibold">
          Letcal admin
        </Link>
        <ul className="flex flex-wrap gap-1 md:flex-col">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                {item.label}
                {item.href === "/admin" && (
                  <Suspense>
                    <HealthBadge />
                  </Suspense>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/en" target="_blank" className="text-sm underline">
          Xem trang ↗
        </Link>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex justify-end">
          <Suspense>
            <SignedInAs />
          </Suspense>
        </div>
        {children}
      </div>
    </div>
  );
}
