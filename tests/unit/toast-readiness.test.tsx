import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { expect, it, vi } from "vitest";
const order = vi.hoisted(() => [] as string[]);
vi.mock("@/components/ui/sonner", () => ({
  Toaster: function Outlet() {
    useEffect(() => {
      order.push("subscribed");
    }, []);
    return null;
  },
}));
it("queues the first request before any outlet exists and resolves after its child subscription", async () => {
  const { ensureToaster, toasterRequested, subscribeToaster } =
    await import("@/components/site/toast-readiness");
  const listener = vi.fn();
  const unsubscribe = subscribeToaster(listener);
  expect(toasterRequested()).toBe(false);
  let delivered = false;
  const first = ensureToaster().then(() => {
    expect(order).toContain("subscribed");
    delivered = true;
  });
  expect(toasterRequested()).toBe(true);
  expect(listener).toHaveBeenCalledTimes(1);
  await Promise.resolve();
  expect(delivered).toBe(false);
  const { default: ReadyToaster } =
    await import("@/components/site/ReadyToaster");
  render(<ReadyToaster />);
  await act(async () => {
    await first;
  });
  await waitFor(() => expect(delivered).toBe(true));
  await expect(ensureToaster()).resolves.toBeUndefined();
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
});
