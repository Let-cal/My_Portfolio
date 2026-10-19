"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }
  return (
    <Button variant="outline" size="sm" onClick={signOut}>
      Đăng xuất
    </Button>
  );
}
