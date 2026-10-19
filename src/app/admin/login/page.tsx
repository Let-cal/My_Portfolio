import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";
import { isSupabaseConfigured } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Letcal admin</p>
        <h1 className="mt-1 text-2xl font-semibold">Đăng nhập</h1>
      </div>
      {isSupabaseConfigured() ? (
        <Suspense>
          <LoginForm />
        </Suspense>
      ) : (
        <p role="alert" className="rounded-md border p-3 text-sm">
          Chưa cấu hình Supabase, xem README.
        </p>
      )}
    </main>
  );
}
