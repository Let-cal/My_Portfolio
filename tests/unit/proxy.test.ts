import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

const adminGuard = vi.hoisted(() => vi.fn());
const i18nHandler = vi.hoisted(() => vi.fn());
const createMiddleware = vi.hoisted(() => vi.fn(() => i18nHandler));
vi.mock("@/lib/admin/guard", () => ({ adminGuard }));
// next-intl's ESM build does not resolve `next/server` under vitest; the real redirect is checked against the built app.
vi.mock("next-intl/middleware", () => ({ default: createMiddleware }));

import { routing } from "@/i18n/routing";
import proxy, { config } from "@/proxy";

// Recorded at import time: mock call history is cleared between tests.
const createMiddlewareArgs = [...createMiddleware.mock.calls[0]];

describe("proxy", () => {
  it("sends /admin paths to the admin guard", async () => {
    adminGuard.mockResolvedValue(NextResponse.next());
    await proxy(new NextRequest("http://localhost/admin/projects"));
    expect(adminGuard).toHaveBeenCalledTimes(1);
  });

  it("sends everything else to the next-intl middleware built from the routing config", async () => {
    adminGuard.mockClear();
    i18nHandler.mockReturnValue(NextResponse.next());
    await proxy(new NextRequest("http://localhost/"));
    await proxy(new NextRequest("http://localhost/ja"));
    await proxy(new NextRequest("http://localhost/administrator"));
    expect(i18nHandler).toHaveBeenCalledTimes(3);
    expect(adminGuard).not.toHaveBeenCalled();
    expect(createMiddlewareArgs).toEqual([routing]);
  });

  it("skips api, _next, _vercel and files with an extension", () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    for (const skipped of [
      "/api/x",
      "/_next/static/a.js",
      "/_vercel/x",
      "/cv/file.pdf",
      "/favicon.ico",
    ]) {
      expect(re.test(skipped), skipped).toBe(false);
    }
    for (const matched of ["/", "/en", "/ja/quick", "/admin"]) {
      expect(re.test(matched), matched).toBe(true);
    }
  });
});
