"use client";

import { WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { setNetworkDown, useAdminActionState } from "@/lib/admin/action-errors";
import { isAdminSessionBlocked } from "@/lib/admin/action-errors";

const subscribe = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

/**
 * A thin bar while the browser is offline or a save could not reach the server. Back online,
 * the screen refreshes once to catch up on anything missed.
 */
export function ConnectionBanner() {
  const router = useRouter();
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const { networkDown } = useAdminActionState();

  useEffect(() => {
    const back = () => {
      setNetworkDown(false);
      if (!isAdminSessionBlocked()) router.refresh();
    };
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, [router]);

  if (online && !networkDown) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 -mx-4 flex items-center justify-center gap-2 bg-amber-500/90 px-4 py-1.5 text-sm font-medium text-amber-950"
    >
      <WifiOff aria-hidden className="size-4" />
      Mất kết nối — thay đổi chưa được lưu. Trang sẽ tự cập nhật khi có mạng
      lại.
    </div>
  );
}
