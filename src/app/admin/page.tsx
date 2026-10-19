import { Suspense } from "react";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { getAdminEmail } from "@/lib/admin/session";

async function SignedInAs() {
  const email = await getAdminEmail();
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span>{email}</span>
      <SignOutButton />
    </div>
  );
}

export default function AdminHomePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Quản trị nội dung</h1>
        <Suspense>
          <SignedInAs />
        </Suspense>
      </header>
    </main>
  );
}
