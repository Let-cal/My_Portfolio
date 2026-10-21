import { act, fireEvent, render, screen } from "@testing-library/react";
import Link from "next/link";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  callback: undefined as
    undefined | ((event: string, session: unknown) => void),
  unsubscribe: vi.fn(),
  check: vi.fn(),
  signIn: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabase: () => ({
    auth: {
      onAuthStateChange: (cb: typeof mocks.callback) => {
        mocks.callback = cb;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
      signInWithPassword: mocks.signIn,
    },
  }),
}));
vi.mock("@/app/admin/actions", () => ({ checkAdminSession: mocks.check }));
vi.mock("@/lib/admin/auth-navigation", () => ({
  replaceAuthPage: mocks.navigate,
  isSigningOut: () => false,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("next=%2Fadmin%2Fskills"),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
import { AdminSessionSync } from "@/components/admin/AdminSessionSync";
import { LoginForm } from "@/components/admin/LoginForm";
import { SessionExpiredDialog } from "@/components/admin/SessionExpiredDialog";
import {
  closeSessionExpired,
  isAdminSessionBlocked,
  resetActionState,
} from "@/lib/admin/action-errors";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.check.mockResolvedValue({ ok: true });
  act(() => resetActionState());
});
afterEach(() => vi.useRealTimers());

it("other-tab sign-out opens a dialog without replacing the form; dismissal stays blocked", async () => {
  render(
    <>
      <AdminSessionSync />
      <SessionExpiredDialog />
      <input aria-label="draft" defaultValue="kept" />
      <Link href="/admin/skills">Skills</Link>
    </>,
  );
  act(() => mocks.callback?.("SIGNED_OUT", null));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect((screen.getByLabelText("draft") as HTMLInputElement).value).toBe(
    "kept",
  );
  act(() => closeSessionExpired());
  expect(isAdminSessionBlocked()).toBe(true);
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  act(() => screen.getByText("Skills").dispatchEvent(click));
  expect(click.defaultPrevented).toBe(true);
  expect(screen.getByRole("dialog")).toBeTruthy();
});
it("only a verified new session unblocks editing; stale checks cannot undo sign-out", async () => {
  let finish!: (value: { ok: boolean }) => void;
  mocks.check.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<AdminSessionSync />);
  act(() => mocks.callback?.("SIGNED_IN", { user: { id: "a" } }));
  await act(async () => {});
  act(() => mocks.callback?.("SIGNED_OUT", null));
  await act(async () => finish({ ok: true }));
  expect(isAdminSessionBlocked()).toBe(true);
  mocks.check.mockResolvedValue({ ok: true });
  await act(async () => mocks.callback?.("SIGNED_IN", { user: { id: "a" } }));
  expect(isAdminSessionBlocked()).toBe(false);
});
it("unsubscribes and does not accept a failed recovery", async () => {
  mocks.check.mockResolvedValue({ ok: false, code: "SESSION_EXPIRED" });
  const { unmount } = render(<AdminSessionSync />);
  act(() => mocks.callback?.("SIGNED_OUT", null));
  await act(async () => mocks.callback?.("SIGNED_IN", { user: { id: "a" } }));
  expect(isAdminSessionBlocked()).toBe(true);
  unmount();
  expect(mocks.unsubscribe).toHaveBeenCalled();
});
it("does not run a queued sign-in verification after a newer sign-out", async () => {
  render(<AdminSessionSync />);
  await act(async () => {
    mocks.callback?.("SIGNED_IN", { user: { id: "a" } });
    mocks.callback?.("SIGNED_OUT", null);
  });
  expect(isAdminSessionBlocked()).toBe(true);
  expect(mocks.check).not.toHaveBeenCalled();
});
it("manual recovery keeps the dialog open until the server accepts the session", async () => {
  mocks.check.mockResolvedValue({ ok: false, code: "SESSION_EXPIRED" });
  render(
    <>
      <AdminSessionSync />
      <SessionExpiredDialog />
    </>,
  );
  act(() => mocks.callback?.("INITIAL_SESSION", null));
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Tôi đã đăng nhập lại" }),
    ),
  );
  expect(screen.getByRole("dialog")).toBeTruthy();
  mocks.check.mockResolvedValue({ ok: true });
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Tôi đã đăng nhập lại" }),
    ),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});
function submitLogin() {
  render(<LoginForm />);
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "admin@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), {
    target: { value: "example-only" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Đăng nhập" }).closest("form")!,
  );
}
it("login rejection releases pending and shows a recoverable error", async () => {
  mocks.signIn.mockRejectedValue(new TypeError("network"));
  submitLogin();
  await act(async () => {});
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Đăng nhập" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
it("does not mislabel a returned Supabase network error as bad credentials", async () => {
  mocks.signIn.mockResolvedValue({
    error: { name: "AuthRetryableFetchError", status: 0 },
  });
  submitLogin();
  await act(async () => {});
  expect(screen.getByRole("alert").textContent).toContain(
    "Không thể hoàn tất đăng nhập",
  );
});
it("login has a bounded wait and ignores a late completion", async () => {
  vi.useFakeTimers();
  let finish!: (value: { error: null }) => void;
  mocks.signIn.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  submitLogin();
  await act(async () => vi.advanceTimersByTime(20000));
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Đăng nhập" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  await act(async () => finish({ error: null }));
  expect(mocks.navigate).not.toHaveBeenCalled();
});
it("successful login replaces the full document with a safe admin path", async () => {
  mocks.signIn.mockResolvedValue({ error: null });
  submitLogin();
  await act(async () => {});
  expect(mocks.navigate).toHaveBeenCalledWith("/admin/skills");
});
it("a failed navigation releases login pending instead of leaving a spinner", async () => {
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.navigate.mockImplementationOnce(() => {
    throw new Error("blocked");
  });
  submitLogin();
  await act(async () => {});
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Đăng nhập" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
