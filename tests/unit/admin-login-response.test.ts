import { describe, it, expect, vi } from "vitest";
import * as capture from "../e2e-admin/login-response";

describe("UI login response lifetime", () => {
  it("permits only the live read-only user verification endpoint", () => {
    expect(typeof capture.assertReadOnlyUserRequest).toBe("function");
    const api = "http://127.0.0.1:55321";
    expect(() =>
      capture.assertReadOnlyUserRequest(
        `${api}/auth/v1/user`,
        { method: "GET" },
        api,
      ),
    ).not.toThrow();
    for (const [url, method] of [
      [`${api}/auth/v1/token?grant_type=refresh_token`, "POST"],
      [`${api}/auth/v1/user`, "PUT"],
      [`${api}/auth/v1/user?extra=true`, "GET"],
      [`${api}/auth/v1/user#extra`, "GET"],
      [`${api}/rest/v1/certificates`, "GET"],
      ["https://hosted.supabase.co/auth/v1/user", "GET"],
      ["http://user:pass@127.0.0.1:55321/auth/v1/user", "GET"],
    ])
      expect(() =>
        capture.assertReadOnlyUserRequest(url, { method }, api),
      ).toThrow();
  });
  it("captures actual request headers without reading a response body lost on navigation", async () => {
    expect(typeof capture.captureLoginResponse).toBe("function");
    const json = vi.fn(() => {
      throw new Error("No resource with given identifier");
    });
    const provisional = vi.fn(() => ({}));
    const allHeaders = vi.fn(async () => ({
      apikey: "synthetic-anon",
      authorization: "PRIVATE-SENTINEL",
    }));
    const response = {
      ok: () => true,
      request: () => ({ allHeaders, headers: provisional }),
      json,
    };
    expect(await capture.captureLoginResponse(response)).toEqual({
      ok: true,
      apiKey: "synthetic-anon",
    });
    expect(json).not.toHaveBeenCalled();
    expect(provisional).not.toHaveBeenCalled();
    expect(allHeaders).toHaveBeenCalledOnce();
  });
  it("does not treat a failed HTTP login as a valid session", async () => {
    const allHeaders = vi.fn(async () => ({ apikey: "synthetic-anon" }));
    expect(
      await capture.captureLoginResponse({
        ok: () => false,
        request: () => ({ allHeaders }),
      }),
    ).toEqual({ ok: false });
    expect(allHeaders).not.toHaveBeenCalled();
  });
});
