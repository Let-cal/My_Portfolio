import { FormSkeleton } from "@/components/admin/Skeletons";
import { Suspense } from "react";
import { ProfileForm } from "@/components/admin/SingletonForms";
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
      <h1 className="text-2xl font-semibold">Hồ sơ</h1>
      <p className="text-sm text-muted-foreground">
        Trang công khai không bao giờ hiển thị số điện thoại.
      </p>
      <Suspense fallback={<FormSkeleton />}>
        <Editor />
      </Suspense>
    </main>
  );
}
