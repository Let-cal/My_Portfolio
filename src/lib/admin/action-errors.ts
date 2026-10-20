"use client";

// One place where every admin write is called from the browser: network failures become a
// retryable error, an expired session opens the sign-in-again dialog (the form stays as it is),
// and anything else is shown as the action's own message.
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/app/admin/actions";
import { beginOwnWrite, endOwnWrite } from "./own-writes";

type State = { sessionExpired: boolean; networkDown: boolean };
let state: State = { sessionExpired: false, networkDown: false };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The shared session and connection state, for the dialog and the connection banner. */
export function useAdminActionState(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export const closeSessionExpired = () => set({ sessionExpired: false });
export const setNetworkDown = (down: boolean) => set({ networkDown: down });
/** For tests. */
export const resetActionState = () =>
  set({ sessionExpired: false, networkDown: false });

type Failure = Extract<ActionResult, { ok: false }>;

/** Shows a failed result: dialog for an expired session, retry toast for the network, else the message. */
export function showActionError(result: Failure, retry?: () => void) {
  if (result.code === "SESSION_EXPIRED") {
    set({ sessionExpired: true });
    return;
  }
  if (result.code === "STALE") {
    toast.error(result.error, {
      action: { label: "Tải lại", onClick: () => window.location.reload() },
    });
    return;
  }
  if (result.code === "NETWORK") {
    toast.error("Không kết nối được máy chủ. Thay đổi chưa được lưu.", {
      action: retry ? { label: "Thử lại", onClick: retry } : undefined,
    });
    return;
  }
  toast.error(result.error, undefined);
}

/** What a thrown action means: an old page after a deploy, a lost connection, or a plain error. */
function thrownFailure(error: unknown): Failure {
  if (error instanceof Error && error.name === "UnrecognizedActionError")
    return {
      ok: false,
      error:
        "Trang đã cũ vì vừa có bản cập nhật. Tải lại trang (bản nháp vẫn được giữ).",
      code: "STALE",
    };
  if (error instanceof TypeError)
    return { ok: false, error: "Không kết nối được máy chủ.", code: "NETWORK" };
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Runs a server action. A thrown request (offline, server down) becomes a NETWORK failure, and
 * every failure is shown unless `silent` (callers that show errors inline, e.g. form fields).
 */
export async function runAction<R extends { ok: boolean }>(
  action: () => Promise<R>,
  { retry, silent = false }: { retry?: () => void; silent?: boolean } = {},
): Promise<R | Failure> {
  let result: R | Failure;
  beginOwnWrite();
  try {
    result = await action();
  } catch (error) {
    result = thrownFailure(error);
  } finally {
    // The echo of this write arrives over Realtime around now: not news for this tab.
    endOwnWrite();
  }
  if (result.ok) {
    if (state.networkDown) set({ networkDown: false });
    return result;
  }
  const failure = result as unknown as Failure;
  if (failure.code === "NETWORK") set({ networkDown: true });
  if (
    !silent ||
    failure.code === "SESSION_EXPIRED" ||
    failure.code === "NETWORK" ||
    failure.code === "STALE"
  )
    showActionError(failure, retry);
  return result;
}
