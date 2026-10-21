import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
);
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => "/admin/certificates",
}));

type Handler = (message: { payload: unknown }) => void;
const channel = vi.hoisted(() => {
  const state: { handler?: Handler; status?: (s: string) => void } = {};
  const api = {
    state,
    on: vi.fn((_type: string, _filter: unknown, handler: Handler) => {
      state.handler = handler;
      return api;
    }),
    subscribe: vi.fn((cb: (s: string) => void) => {
      state.status = cb;
      return api;
    }),
  };
  return api;
});
const setAuth = vi.fn(async () => {});
const removeChannel = vi.fn();
const channelFn = vi.fn(() => channel);
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabase: () => ({
    realtime: { setAuth },
    channel: channelFn,
    removeChannel,
  }),
}));

const { RealtimeSync } = await import("@/components/admin/RealtimeSync");
const { markOwnWrite, resetOwnWrites } = await import("@/lib/admin/own-writes");
const { expireAdminSession, resetActionState } =
  await import("@/lib/admin/action-errors");

const send = (payload: unknown) =>
  act(() => channel.state.handler?.({ payload }));

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockReset();
  toast.mockReset();
  resetOwnWrites();
  resetActionState();
});
afterEach(() => vi.useRealTimers());

describe("RealtimeSync", () => {
  it("does not refresh expired editors on a queued change or reconnect", async () => {
    render(<RealtimeSync />);
    await act(async () => {});
    act(() => channel.state.status?.("SUBSCRIBED"));
    send({ table: "projects", op: "update", key: "a" });
    act(() => expireAdminSession());
    await act(async () => vi.advanceTimersByTime(500));
    act(() => channel.state.status?.("CHANNEL_ERROR"));
    act(() => channel.state.status?.("SUBSCRIBED"));
    expect(refresh).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
  it("listens on the private admin topic", async () => {
    render(<RealtimeSync />);
    await act(async () => {});
    expect(setAuth).toHaveBeenCalled();
    expect(channelFn).toHaveBeenCalledWith("admin:content", {
      config: { private: true },
    });
  });

  it("refreshes once for a burst of changes made elsewhere, and says so", async () => {
    render(<RealtimeSync />);
    await act(async () => {});
    send({ table: "projects", op: "update", key: "a" });
    send({ table: "projects", op: "update", key: "b" });
    await act(async () => vi.advanceTimersByTime(500));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith("Đã cập nhật từ nơi khác");
  });

  it("stays quiet about this tab's own changes", async () => {
    render(<RealtimeSync />);
    await act(async () => {});
    markOwnWrite();
    send({ table: "projects", op: "update", key: "a" });
    await act(async () => vi.advanceTimersByTime(500));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
  });

  it("catches up once after a reconnect", async () => {
    render(<RealtimeSync />);
    await act(async () => {});
    act(() => channel.state.status?.("SUBSCRIBED"));
    expect(refresh).not.toHaveBeenCalled();
    act(() => channel.state.status?.("CHANNEL_ERROR"));
    act(() => channel.state.status?.("SUBSCRIBED"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
