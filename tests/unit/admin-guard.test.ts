import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser }, rpc }),
}));

const { adminGuard } = await import("@/lib/admin/guard");

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test",
  ADMIN_EMAIL: "admin@x.com",
};
const request = (path: string) =>
  new NextRequest(new URL(path, "https://letcal.test"));

describe("adminGuard", () => {
  beforeEach(() => {
    getUser.mockReset();
    rpc.mockReset().mockResolvedValue({ data: null, error: null });
  });

  it("always lets the login page through", async () => {
    const res = await adminGuard(request("/admin/login"), env);
    expect(res.headers.get("location")).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("sends visitors without a session to the login page with the path to return to", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await adminGuard(request("/admin/projects"), env);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://letcal.test/admin/login?next=%2Fadmin%2Fprojects",
    );
  });

  it("sends signed-in users who are not the admin to the login page", async () => {
    getUser.mockResolvedValue({
      data: { user: { email: "someone@x.com" } },
      error: null,
    });
    const res = await adminGuard(request("/admin"), env);
    expect(res.headers.get("location")).toContain("/admin/login");
  });

  it("tells a signed-in user without access why they are back at the login page", async () => {
    getUser.mockResolvedValue({
      data: { user: { email: "someone@x.com" } },
      error: null,
    });
    const res = await adminGuard(request("/admin/projects"), env);
    expect(res.headers.get("location")).toBe(
      "https://letcal.test/admin/login?next=%2Fadmin%2Fprojects&denied=1",
    );
  });

  it("lets the admin through", async () => {
    getUser.mockResolvedValue({
      data: { user: { email: "Admin@x.com" } },
      error: null,
    });
    const res = await adminGuard(request("/admin"), env);
    expect(res.headers.get("location")).toBeNull();
  });

  it("sends everyone to the login page while Supabase is not configured", async () => {
    const res = await adminGuard(request("/admin"), {});
    expect(res.headers.get("location")).toContain("/admin/login");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("lets server actions through without a session so they can answer 'session expired'", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const req = new NextRequest(
      new URL("/admin/certificates/new", "https://letcal.test"),
      {
        method: "POST",
        headers: { "next-action": "abc123" },
      },
    );
    const res = await adminGuard(req, env);
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("still redirects page requests that only carry a Next-Action header", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const req = new NextRequest(
      new URL("/admin/experiences", "https://letcal.test"),
      {
        headers: { "next-action": "abc123" },
      },
    );
    const res = await adminGuard(req, env);
    expect(res.status).toBe(307);
  });

  it("lets the read-only reviewer into admin pages", async () => {
    getUser.mockResolvedValue({
      data: { user: { email: "r@example.invalid" } },
      error: null,
    });
    rpc.mockResolvedValue({ data: "reviewer", error: null });
    const res = await adminGuard(request("/admin/projects"), env);
    expect(res.headers.get("location")).toBeNull();
    expect(rpc).toHaveBeenCalledWith("admin_access_kind");
  });

  it("still sends an ordinary signed-in user to login, and fails closed on a lookup error", async () => {
    getUser.mockResolvedValue({
      data: { user: { email: "m@example.invalid" } },
      error: null,
    });
    rpc.mockResolvedValue({ data: "reviewer", error: { message: "boom" } });
    const res = await adminGuard(request("/admin/projects"), env);
    expect(res.headers.get("location")).toContain("/admin/login");
  });
});
