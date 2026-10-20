import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { ConnectionBanner } =
  await import("@/components/admin/ConnectionBanner");
const { setNetworkDown, resetActionState } =
  await import("@/lib/admin/action-errors");

beforeEach(() => {
  refresh.mockReset();
  act(() => resetActionState());
});

describe("ConnectionBanner", () => {
  it("appears while offline and refreshes once when back online", async () => {
    render(<ConnectionBanner />);
    expect(screen.queryByRole("status")).toBeNull();
    const goOnline = (value: boolean) =>
      Object.defineProperty(navigator, "onLine", { value, configurable: true });
    goOnline(false);
    await act(async () => window.dispatchEvent(new Event("offline")));
    expect(screen.getByRole("status").textContent).toContain("Mất kết nối");
    goOnline(true);
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(screen.queryByRole("status")).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("appears after a save failed for lack of connection", async () => {
    render(<ConnectionBanner />);
    await act(async () => setNetworkDown(true));
    expect(screen.getByRole("status").textContent).toContain(
      "thay đổi chưa được lưu",
    );
  });
});
