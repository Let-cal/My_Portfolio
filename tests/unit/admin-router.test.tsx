import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
import { useAdminRouter } from "@/lib/admin/use-admin-router";
import {
  expireAdminSession,
  closeSessionExpired,
  resumeAdminSession,
  resetActionState,
} from "@/lib/admin/action-errors";
beforeEach(() => {
  vi.clearAllMocks();
  resetActionState();
});
it("blocks programmatic routes, history and refresh after dialog dismissal, then resumes after verification", () => {
  const { result } = renderHook(() => useAdminRouter());
  act(() => {
    expireAdminSession();
    closeSessionExpired();
  });
  act(() => {
    result.current.push("/admin");
    result.current.replace("/admin/skills");
    result.current.back();
    result.current.forward();
    result.current.refresh();
  });
  for (const name of ["push", "replace", "back", "forward", "refresh"] as const)
    expect(router[name]).not.toHaveBeenCalled();
  act(() => resumeAdminSession());
  result.current.push("/admin");
  expect(router.push).toHaveBeenCalledWith("/admin");
});
