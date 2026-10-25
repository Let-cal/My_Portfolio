import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { getUser }, rpc }),
}));

const { resolveAccess, getAdminAccess, requireContentRead } =
  await import("@/lib/admin/access");

const ADMIN = "admin@example.test";

beforeEach(() => {
  getUser.mockReset();
  rpc.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_test");
  vi.stubEnv("ADMIN_EMAIL", ADMIN);
});

describe("resolveAccess", () => {
  it("is admin only for the configured admin email", () => {
    expect(resolveAccess({ email: ADMIN }, null, ADMIN)).toEqual({
      kind: "admin",
      email: ADMIN,
    });
    expect(
      resolveAccess({ email: "ADMIN@example.test " }, null, ADMIN)?.kind,
    ).toBe("admin");
  });

  it("is reviewer only when the database says so for a non-admin user", () => {
    expect(
      resolveAccess({ email: "r@example.test" }, "reviewer", ADMIN),
    ).toEqual({
      kind: "reviewer",
      email: "r@example.test",
    });
  });

  it("refuses everything else, failing closed", () => {
    for (const kind of [null, undefined, "", "admin", "Reviewer", 1, {}]) {
      expect(
        resolveAccess({ email: "m@example.test" }, kind, ADMIN),
      ).toBeNull();
    }
    expect(resolveAccess(null, "reviewer", ADMIN)).toBeNull();
    expect(resolveAccess({ email: null }, "reviewer", ADMIN)).toBeNull();
    // A database "admin" answer never promotes a user the app does not know as admin.
    expect(
      resolveAccess({ email: "m@example.test" }, "admin", ADMIN),
    ).toBeNull();
  });

  it("ignores editable user metadata", () => {
    const user = {
      email: "m@example.test",
      user_metadata: { role: "reviewer", reviewer: true },
      app_metadata: { role: "admin" },
    };
    expect(resolveAccess(user, null, ADMIN)).toBeNull();
  });
});

describe("getAdminAccess", () => {
  it("does not ask the database about the admin", async () => {
    getUser.mockResolvedValue({ data: { user: { email: ADMIN } } });
    expect(await getAdminAccess()).toEqual({ kind: "admin", email: ADMIN });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("asks the database whether a non-admin user is a reviewer", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "r@example.test" } } });
    rpc.mockResolvedValue({ data: "reviewer", error: null });
    expect(await getAdminAccess()).toEqual({
      kind: "reviewer",
      email: "r@example.test",
    });
    expect(rpc).toHaveBeenCalledWith("admin_access_kind");
  });

  it("treats a database error as no access", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "r@example.test" } } });
    rpc.mockResolvedValue({ data: "reviewer", error: { message: "boom" } });
    expect(await getAdminAccess()).toBeNull();
  });

  it("sees a revoked reviewer at once, on the next request", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "r@example.test" } } });
    rpc.mockResolvedValueOnce({ data: "reviewer", error: null });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect((await getAdminAccess())?.kind).toBe("reviewer");
    expect(await getAdminAccess()).toBeNull();
  });
});

describe("requireContentRead", () => {
  it("lets the admin and the reviewer read", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "r@example.test" } } });
    rpc.mockResolvedValue({ data: "reviewer", error: null });
    await expect(requireContentRead()).resolves.toEqual({
      kind: "reviewer",
      email: "r@example.test",
    });
  });

  it("says the session expired when nobody is signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireContentRead()).rejects.toThrow("SESSION_EXPIRED");
  });

  it("refuses an ordinary signed-in user", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "m@example.test" } } });
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(requireContentRead()).rejects.toThrow("FORBIDDEN");
  });
});
