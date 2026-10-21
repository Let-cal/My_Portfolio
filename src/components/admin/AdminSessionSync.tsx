"use client";

import { useEffect } from "react";
import { checkAdminSession } from "@/app/admin/actions";
import {
  blockAdminSession,
  expireAdminSession,
  isAdminSessionBlocked,
  resumeAdminSession,
} from "@/lib/admin/action-errors";
import { isSigningOut } from "@/lib/admin/auth-navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/** Session events never refresh or replace an open editor. Authorization stays server-side. */
export function AdminSessionSync() {
  useEffect(() => {
    let stopped = false,
      generation = 0;
    const verify = async () => {
      const current = ++generation;
      try {
        const result = await checkAdminSession();
        if (stopped || current !== generation || isSigningOut()) return;
        if (result.ok) resumeAdminSession();
        else if (
          result.code === "SESSION_EXPIRED" ||
          result.code === "FORBIDDEN"
        )
          expireAdminSession();
      } catch {
        /* A connection failure is not proof of an expired session. */
      }
    };
    const {
      data: { subscription },
    } = createBrowserSupabase().auth.onAuthStateChange((event, session) => {
      if (stopped) return;
      if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session)) {
        ++generation;
        blockAdminSession();
        if (!isSigningOut()) expireAdminSession();
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // Defer server calls until outside the auth event callback.
        const scheduled = ++generation;
        void Promise.resolve().then(() => {
          if (!stopped && scheduled === generation) return verify();
        });
      }
    });
    const focus = () => {
      if (isAdminSessionBlocked()) void verify();
    };
    const click = (event: MouseEvent) => {
      if (!isAdminSessionBlocked() || isSigningOut()) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      const url = new URL(link.getAttribute("href")!, location.href);
      if (
        url.origin !== location.origin ||
        !/^\/admin(?:\/|$)/.test(url.pathname) ||
        url.pathname === "/admin/login"
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      expireAdminSession();
    };
    window.addEventListener("focus", focus);
    window.addEventListener("admin:verify-session", focus);
    document.addEventListener("click", click, true);
    return () => {
      stopped = true;
      ++generation;
      subscription.unsubscribe();
      window.removeEventListener("focus", focus);
      window.removeEventListener("admin:verify-session", focus);
      document.removeEventListener("click", click, true);
    };
  }, []);
  return null;
}
