import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  replace: vi.fn(),
  intent: vi.fn(),
}));
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabase: () => ({ auth: { signOut: mocks.signOut } }),
}));
vi.mock("@/lib/admin/auth-navigation", () => ({
  replaceAuthPage: mocks.replace,
  setSigningOut: mocks.intent,
}));
import { SignOutButton } from "@/components/admin/SignOutButton";
beforeEach(() => vi.resetAllMocks());
it("marks only this tab as intentional before sign-out and replaces the auth document", async () => {
  mocks.signOut.mockImplementation(async () => {
    expect(mocks.intent).toHaveBeenCalledWith(true);
    return { error: null };
  });
  render(<SignOutButton />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" })),
  );
  expect(mocks.replace).toHaveBeenCalledWith("/admin/login");
  expect(mocks.intent).toHaveBeenLastCalledWith(false);
});
it("sign-out failure clears intent and pending, reports failure, and does not navigate", async () => {
  mocks.signOut.mockRejectedValue(new TypeError("offline"));
  render(<SignOutButton />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" })),
  );
  expect(mocks.intent).toHaveBeenLastCalledWith(false);
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
});
