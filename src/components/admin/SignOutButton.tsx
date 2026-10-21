"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { replaceAuthPage, setSigningOut } from "@/lib/admin/auth-navigation";
import {
  expireAdminSession,
  isAdminSessionBlocked,
} from "@/lib/admin/action-errors";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function signOut() {
    if (pending) return;
    setPending(true);
    setError(null);
    setSigningOut(true);
    try {
      const { error } = await createBrowserSupabase().auth.signOut();
      if (error) throw error;
      replaceAuthPage("/admin/login");
    } catch {
      setSigningOut(false);
      // A failed remote logout may still have removed the local session.
      try {
        const { data } = await createBrowserSupabase().auth.getSession();
        if (!data.session) expireAdminSession();
      } catch {
        expireAdminSession();
      }
      setError("Không thể đăng xuất. Vui lòng thử lại.");
    } finally {
      setSigningOut(false);
      // location.replace may be cancelled by beforeunload. Keep that surviving editor safe.
      if (isAdminSessionBlocked()) expireAdminSession();
      setPending(false);
    }
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={signOut} disabled={pending}>
        Đăng xuất
      </Button>
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </>
  );
}
