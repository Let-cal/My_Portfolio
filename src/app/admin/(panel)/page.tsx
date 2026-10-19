import Link from "next/link";
import { Suspense } from "react";
import { HealthList } from "@/components/admin/HealthList";
import { OpenToWorkSwitch } from "@/components/admin/SingletonForms";
import { countRows, getAdminContent, lastEdited } from "@/lib/admin/data";
import { checkContentHealth, translationStats } from "@/lib/admin/health";
import { resources } from "@/lib/admin/resources";

function relativeTime(iso: string): string {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  if (Math.abs(minutes) < 60 * 24) return rtf.format(Math.round(minutes / 60), "hour");
  return rtf.format(Math.round(minutes / 1440), "day");
}

function Card({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-4">
      <span className="text-xs tracking-wide text-muted-foreground uppercase">{label}</span>
      <div className="text-2xl font-semibold tabular-nums">{children}</div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

async function Overview() {
  const [content, counts, last] = await Promise.all([getAdminContent(), countRows(), lastEdited()]);
  const issues = checkContentHealth(content);
  const t = translationStats(content);
  const translated = t.total ? Math.round((100 * (t.ja + t.vi)) / (2 * t.total)) : 100;
  const hidden = counts.reduce((n, c) => n + c.hidden, 0);
  const attention = issues.filter((i) => i.severity !== "info").length;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-center rounded-lg border p-4">
          <OpenToWorkSwitch initial={content.profile.openToWork} />
        </div>
        <Card label="Bản dịch" hint={`JA ${t.ja}/${t.total} · VI ${t.vi}/${t.total}`}>{translated}%</Card>
        <Card label="Đang ẩn" hint="mục khách chưa thấy">{hidden}</Card>
        <Card label="Sửa gần nhất" hint={last ? relativeTime(last.at) : undefined}>
          <span className="block truncate text-base">{last?.label ?? "—"}</span>
        </Card>
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Cần chú ý {attention > 0 && <span className="text-muted-foreground">({attention})</span>}</h2>
        <HealthList issues={issues} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Nội dung</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {counts.map(({ key, count, hidden: h }) => (
            <li key={key}>
              <Link href={`/admin/${key}`} className="flex flex-col gap-1 rounded-lg border p-4 hover:bg-muted">
                <span className="text-sm text-muted-foreground">{resources[key].label}</span>
                <span className="text-2xl font-semibold tabular-nums">{count}</span>
                {h > 0 && <span className="text-xs text-muted-foreground">{h} đang ẩn</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>
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
