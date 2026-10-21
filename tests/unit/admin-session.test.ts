import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { getUser } }),
}));

const { requireAdmin } = await import("@/lib/admin/session");

describe("requireAdmin", () => {
  beforeEach(() => {
    getUser.mockReset();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_test");
    vi.stubEnv("ADMIN_EMAIL", "admin@x.com");
  });

  it("says the session expired when nobody is signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireAdmin()).rejects.toThrow("SESSION_EXPIRED");
  });

  it("refuses a signed-in user who is not the admin", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "x@y.z" } } });
    await expect(requireAdmin()).rejects.toThrow("FORBIDDEN");
  });

  it("returns the admin", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "admin@x.com" } } });
    await expect(requireAdmin()).resolves.toEqual({ email: "admin@x.com" });
  });
});
