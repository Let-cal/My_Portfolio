"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { expireAdminSession, isAdminSessionBlocked } from "./action-errors";

/** Guard button/command navigation too; a dismissed dialog does not restore the session. */
export function useAdminRouter() {
  const router = useRouter();
  return useMemo(() => {
    const allow = () => {
      if (!isAdminSessionBlocked()) return true;
      expireAdminSession();
      return false;
    };
    return {
      ...router,
      push: (...args: Parameters<typeof router.push>) => {
        if (allow()) router.push(...args);
      },
      replace: (...args: Parameters<typeof router.replace>) => {
        if (allow()) router.replace(...args);
      },
      back: () => {
        if (allow()) router.back();
      },
      forward: () => {
        if (allow()) router.forward();
      },
      refresh: () => {
        if (!isAdminSessionBlocked()) router.refresh();
      },
    };
  }, [router]);
}
