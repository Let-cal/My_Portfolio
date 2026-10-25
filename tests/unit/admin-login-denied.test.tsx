import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  params: "next=%2Fadmin",
  signOut: vi.fn(),
}));
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabase: () => ({
    auth: { signOut: mocks.signOut, signInWithPassword: vi.fn() },
  }),
}));
vi.mock("@/lib/admin/auth-navigation", () => ({ replaceAuthPage: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mocks.params),
}));
import { LoginForm } from "@/components/admin/LoginForm";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOut.mockResolvedValue({ error: null });
});

it("explains a signed-in account without admin access and signs that session out on this device", async () => {
  mocks.params = "next=%2Fadmin&denied=1";
  render(<LoginForm />);
  expect(screen.getByRole("alert").textContent).toBe(
    "Tài khoản vừa đăng nhập không có quyền vào trang quản trị. Hãy đăng nhập bằng tài khoản khác.",
  );
  await waitFor(() =>
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" }),
  );
});

it("shows no message and keeps the session on a normal visit", () => {
  mocks.params = "next=%2Fadmin";
  render(<LoginForm />);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(mocks.signOut).not.toHaveBeenCalled();
});
