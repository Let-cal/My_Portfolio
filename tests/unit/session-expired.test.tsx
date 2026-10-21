import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { runAction, resetActionState } =
  await import("@/lib/admin/action-errors");
const { SessionExpiredDialog } =
  await import("@/components/admin/SessionExpiredDialog");

beforeEach(() => {
  toast.error.mockReset();
  act(() => resetActionState());
});

describe("runAction", () => {
  it("does not suppress other tabs' updates while reading the media library", async () => {
    const { isRecentOwnWrite, resetOwnWrites } =
      await import("@/lib/admin/own-writes");
    resetOwnWrites();
    let finish: () => void = () => {};
    const running = runAction(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          finish = () => resolve({ ok: true });
        }),
      { write: false },
    );
    expect(isRecentOwnWrite()).toBe(false);
    finish();
    await running;
    expect(isRecentOwnWrite()).toBe(false);
  });
  it("opens the sign-in-again dialog when the session expired, keeping the page", async () => {
    render(<SessionExpiredDialog />);
    await act(async () => {
      await runAction(async () => ({
        ok: false,
        error: "x",
        code: "SESSION_EXPIRED" as const,
      }));
    });
    expect(
      screen.getByRole("dialog", { name: "Phiên đăng nhập đã hết hạn" }),
    ).toBeTruthy();
    const link = screen.getByRole("link", { name: /Đăng nhập lại/ });
    expect(link.getAttribute("href")).toBe("/admin/login?next=%2Fadmin");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("turns a failed request into a retryable network error", async () => {
    const retry = vi.fn();
    const result = await runAction(
      async () => {
        throw new TypeError("Failed to fetch");
      },
      { retry },
    );
    expect(result).toMatchObject({ ok: false, code: "NETWORK" });
    const [message, options] = toast.error.mock.calls[0];
    expect(message).toBe("Không kết nối được máy chủ. Thay đổi chưa được lưu.");
    options.action.onClick();
    expect(retry).toHaveBeenCalled();
  });

  it("shows other errors as they are", async () => {
    await runAction(async () => ({ ok: false, error: "Không xóa được" }));
    expect(toast.error).toHaveBeenCalledWith("Không xóa được", undefined);
  });

  it("passes successes through untouched", async () => {
    expect(await runAction(async () => ({ ok: true }))).toEqual({ ok: true });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("reports a stale page (new deploy) as such, not as a lost connection", async () => {
    const { setNetworkDown, useAdminActionState } =
      await import("@/lib/admin/action-errors");
    void setNetworkDown;
    void useAdminActionState;
    const error = Object.assign(new Error("Server Action not found"), {
      name: "UnrecognizedActionError",
    });
    const result = await runAction(async () => {
      throw error;
    });
    expect(result).toMatchObject({ ok: false, code: "STALE" });
    expect(toast.error.mock.calls[0][0]).toContain("Trang đã cũ");
  });

  it("counts a write that is still running as this tab's own", async () => {
    const { isRecentOwnWrite } = await import("@/lib/admin/own-writes");
    let finish: () => void = () => {};
    const running = runAction(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          finish = () => resolve({ ok: true });
        }),
    );
    // A slow (cold) action: well past the window, yet still running.
    expect(isRecentOwnWrite(Date.now() + 10_000)).toBe(true);
    finish();
    await running;
    expect(isRecentOwnWrite(Date.now() + 10_000)).toBe(false);
  });
});
