import Link from "next/link";
import { Suspense } from "react";
import { OpenToWorkSwitch } from "@/components/admin/SingletonForms";
import { countRows, getProfileAndRoles } from "@/lib/admin/data";
import { resources } from "@/lib/admin/resources";

async function Overview() {
  const [counts, { profile }] = await Promise.all([countRows(), getProfileAndRoles()]);
  return (
    <>
      {profile && <OpenToWorkSwitch initial={profile.openToWork} />}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {counts.map(({ key, count, hidden }) => (
          <li key={key}>
            <Link href={`/admin/${key}`} className="flex flex-col gap-1 rounded-lg border p-4 hover:bg-muted">
              <span className="text-sm text-muted-foreground">{resources[key].label}</span>
              <span className="text-2xl font-semibold tabular-nums">{count}</span>
              {hidden > 0 && <span className="text-xs text-muted-foreground">{hidden} đang ẩn</span>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function AdminHomePage() {
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Tổng quan</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
        <Overview />
      </Suspense>
    </main>
  );
}
