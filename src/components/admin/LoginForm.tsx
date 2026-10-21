"use client";

import { useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNextPath } from "@/lib/admin/auth";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { replaceAuthPage } from "@/lib/admin/auth-navigation";

export function LoginForm() {
  const next = safeNextPath(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const attempt = useRef(0);
  useEffect(
    () => () => {
      ++attempt.current;
    },
    [],
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    busy.current = true;
    const current = ++attempt.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const { error } = await Promise.race([
        createBrowserSupabase().auth.signInWithPassword({
          email: String(form.get("email")),
          password: String(form.get("password")),
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), 20000);
        }),
      ]);
      if (current !== attempt.current) return;
      if (error) {
        setError(
          error.name === "AuthRetryableFetchError" ||
            error.status === 0 ||
            (error.status ?? 0) >= 500
            ? "Không thể hoàn tất đăng nhập. Kiểm tra kết nối rồi thử lại."
            : "Email hoặc mật khẩu không đúng.",
        );
        return;
      }
      replaceAuthPage(next);
    } catch {
      if (current === attempt.current)
        setError("Không thể hoàn tất đăng nhập. Kiểm tra kết nối rồi thử lại.");
    } finally {
      clearTimeout(timer);
      if (current === attempt.current) {
        busy.current = false;
        setPending(false);
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>
    </form>
  );
}
