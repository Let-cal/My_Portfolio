"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  isRecentOwnWrite,
  isRefreshHeld,
  publishChange,
  type ChangeEvent,
} from "@/lib/admin/own-writes";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { isAdminSessionBlocked } from "@/lib/admin/action-errors";

const DEBOUNCE_MS = 400;

/**
 * Live updates across tabs and devices: listens on the private `admin:content` topic (only the
 * admin may receive it) and refreshes the screen shortly after changes made elsewhere. Open forms
 * hear every change note too, so a dirty form is never replaced (see FieldsForm).
 */
export function RealtimeSync() {
  const router = useRouter();
  const pathname = usePathname();
  const path = useRef(pathname);
  useEffect(() => {
    path.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let channel: RealtimeChannel | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fromElsewhere = false;
    let connected = false;
    let lost = false;
    let stopped = false;

    const flush = () => {
      if (isAdminSessionBlocked()) {
        fromElsewhere = false;
        return;
      }
      if (!isRefreshHeld(path.current)) router.refresh();
      if (fromElsewhere) toast("Đã cập nhật từ nơi khác");
      fromElsewhere = false;
    };

    void (async () => {
      await supabase.realtime.setAuth();
      if (stopped) return;
      channel = supabase
        .channel("admin:content", { config: { private: true } })
        .on("broadcast", { event: "change" }, ({ payload }) => {
          publishChange(payload as ChangeEvent);
          if (!isRecentOwnWrite()) fromElsewhere = true;
          clearTimeout(timer);
          timer = setTimeout(flush, DEBOUNCE_MS);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            // Back after a drop: refresh once to catch up on anything missed meanwhile.
            if (
              connected &&
              lost &&
              !isAdminSessionBlocked() &&
              !isRefreshHeld(path.current)
            )
              router.refresh();
            connected = true;
            lost = false;
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            lost = true;
          }
        });
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
