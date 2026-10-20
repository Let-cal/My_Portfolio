import { FormSkeleton } from "@/components/admin/Skeletons";
import { Suspense } from "react";
import { ProfileForm } from "@/components/admin/SingletonForms";
import { VersionHistory } from "@/components/admin/VersionHistory";
import { getProfileAndRoles } from "@/lib/admin/data";

async function Editor() {
  const { profile } = await getProfileAndRoles();
  if (!profile)
    return (
      <p role="alert">Chưa có hồ sơ trong database. Chạy npm run db:seed.</p>
    );
  return <ProfileForm initial={profile} />;
}

export default function ProfilePage() {
  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Hồ sơ</h1>
        <VersionHistory table="profile" itemKey="me" />
      </div>
      <p className="text-sm text-muted-foreground">
        Trang công khai không bao giờ hiển thị số điện thoại.
      </p>
      <Suspense fallback={<FormSkeleton />}>
        <Editor />
      </Suspense>
    </main>
  );
}
