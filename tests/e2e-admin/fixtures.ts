import { randomBytes } from "node:crypto";
import {
  test as base,
  expect,
  type Page,
  type TestInfo,
  type WebSocket,
} from "@playwright/test";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { readTask4Settings, type Task4Settings } from "./settings";
import {
  captureLoginResponse,
  assertReadOnlyUserRequest,
} from "./login-response";

export {
  readTask4Settings,
  localOnlyProxy,
  type Task4Settings,
} from "./settings";

type Access = { apiKey: string; token: string };
const certificateRowsSchema = z
  .array(
    z
      .object({
        id: z.string().regex(/^task4-[a-z0-9-]+$/),
        name: z.string().min(1),
        organization: z.string().min(1),
        issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        published: z.boolean(),
        sort_index: z.number().int().nonnegative(),
      })
      .passthrough(),
  )
  .max(1);
export type CertificateRow = z.infer<typeof certificateRowsSchema>[number];

type RealtimeConnection = {
  socket: WebSocket;
  joinRef?: string;
  joined: boolean;
};

function realtimeFrame(payload: string | Buffer) {
  const frame = JSON.parse(String(payload));
  return Array.isArray(frame)
    ? { ref: frame[1], topic: frame[2], event: frame[3], data: frame[4] }
    : {
        ref: frame.ref,
        topic: frame.topic,
        event: frame.event,
        data: frame.payload,
      };
}

export class AdminHarness {
  private adminAccess?: Access;
  private readonly ownedIds = new Set<string>();
  private readonly connections = new WeakMap<Page, RealtimeConnection>();

  constructor(
    readonly settings: Task4Settings,
    readonly page: Page,
  ) {}

  observe(page: Page) {
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) this.connections.delete(page);
    });
    page.on("websocket", (socket) => {
      if (
        !socket
          .url()
          .startsWith(
            `${this.settings.apiUrl.replace("http:", "ws:")}/realtime/`,
          )
      )
        return;
      const connection: RealtimeConnection = { socket, joined: false };
      this.connections.set(page, connection);
      socket.on("framesent", ({ payload }) => {
        if (this.connections.get(page) !== connection) return;
        try {
          const frame = realtimeFrame(payload);
          if (frame.topic !== "realtime:admin:content") return;
          if (frame.event === "phx_join") {
            connection.joinRef = String(frame.ref);
            connection.joined = false;
          } else if (frame.event === "phx_leave") connection.joined = false;
        } catch {
          // Only the real private-channel join acknowledgement establishes readiness.
        }
      });
      socket.on("framereceived", ({ payload }) => {
        if (this.connections.get(page) !== connection) return;
        try {
          const frame = realtimeFrame(payload);
          if (frame.topic !== "realtime:admin:content") return;
          if (frame.event === "phx_error" || frame.event === "phx_close")
            connection.joined = false;
          else if (
            frame.event === "phx_reply" &&
            connection.joinRef !== undefined &&
            String(frame.ref) === connection.joinRef
          )
            connection.joined = frame.data?.status === "ok";
        } catch {
          // Binary/heartbeat frames are not evidence of a joined private channel.
        }
      });
      socket.on("close", () => {
        if (this.connections.get(page) === connection)
          connection.joined = false;
      });
    });
  }

  async realtimeReady(page: Page) {
    await expect
      .poll(() => this.connections.get(page)?.joined === true, {
        message:
          "The real private Realtime channel must be joined before writing",
      })
      .toBe(true);
  }

  own(label: string) {
    const id = `task4-${label}-${randomBytes(6).toString("hex")}`;
    this.ownedIds.add(id);
    return id;
  }

  async login(page: Page, role: "admin" | "member" = "admin"): Promise<Access> {
    await page.goto("/admin/login?next=%2Fadmin%2Fcertificates");
    const credentials = this.settings[role];
    await page
      .getByRole("textbox", { name: "Email", exact: true })
      .fill(credentials.email);
    await page
      .getByLabel("Mật khẩu", { exact: true })
      .fill(credentials.password);
    const [captured] = await Promise.all([
      page
        .waitForResponse(
          (response) =>
            response.url() ===
              `${this.settings.apiUrl}/auth/v1/token?grant_type=password` &&
            response.request().method() === "POST",
        )
        .then(captureLoginResponse),
      // Login uses location.replace. Even the denied member must finish a new
      // document load; its final URL equals the starting login URL.
      page.waitForEvent("domcontentloaded"),
      page.getByRole("button", { name: "Đăng nhập", exact: true }).click(),
    ]);
    if (!captured.ok) throw new Error("Local UI authentication failed");
    const apiKey = captured.apiKey;
    if (!apiKey) throw new Error("Missing local browser API key");
    try {
      const claims = JSON.parse(
        Buffer.from(apiKey.split(".")[1], "base64url").toString("utf8"),
      );
      if (claims.role !== "anon" || claims.iss !== "supabase-demo")
        throw new Error();
    } catch {
      throw new Error("Browser requests must use the disposable anonymous key");
    }
    // Read the actual UI-created cookies after navigation. The SSR SDK handles
    // chunking/encoding; Auth verifies the user rather than trusting cookie claims.
    const cookies = await page.context().cookies(this.settings.appOrigin);
    const verifier = createServerClient(this.settings.apiUrl, apiKey, {
      cookies: {
        getAll: () => cookies.map(({ name, value }) => ({ name, value })),
        setAll: () => {
          throw new Error("Local UI session must not require repair");
        },
      },
      global: {
        fetch: (input, init) => {
          assertReadOnlyUserRequest(input, init, this.settings.apiUrl);
          return fetch(input, {
            ...init,
            redirect: "error",
            signal: AbortSignal.timeout(10000),
          });
        },
      },
    });
    const session = await verifier.auth.getSession();
    const token = session.data.session?.access_token;
    if (session.error || typeof token !== "string")
      throw new Error("Missing local browser access token");
    const identity = await verifier.auth.getUser(token);
    if (identity.error)
      throw new Error("Local browser identity verification failed");
    if (identity.data.user?.email !== credentials.email)
      throw new Error("Unexpected local browser identity");
    if (identity.data.user?.role !== "authenticated")
      throw new Error("Unexpected local browser user role");
    const access = { apiKey, token };
    if (role === "admin") {
      this.adminAccess = access;
      await this.list(page);
      for (const id of this.settings.fixtures.certificateIds) {
        const rows = await this.read(id);
        if (rows.length !== 1 || rows[0].id !== id || rows[0].published)
          throw new Error("Expected the hidden disposable seed certificates");
      }
    } else {
      await expect(page).toHaveURL(/\/admin\/login\?next=/);
      await expect(
        page.getByRole("heading", { name: "Đăng nhập", exact: true }),
      ).toBeVisible();
    }
    return access;
  }

  async list(page = this.page) {
    await expect(page).toHaveURL(/\/admin\/certificates(?:\?.*)?$/);
    await expect(
      page.getByRole("heading", { name: "Chứng chỉ", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("searchbox", { name: "Tìm trong danh sách" }),
    ).toBeVisible();
    await expect(page.locator("main [aria-busy]")).toHaveAttribute(
      "aria-busy",
      "false",
    );
  }

  row(id: string, page = this.page) {
    return page.locator(`[id="row-${id}"]`);
  }

  async edit(id: string, page = this.page) {
    await page.goto(`/admin/certificates/${id}`);
    await expect(
      page.getByRole("heading", { name: `Sửa ${id}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Tên chứng chỉ" }),
    ).toBeVisible();
  }

  async create(id: string, name = id, page = this.page) {
    if (!this.ownedIds.has(id))
      throw new Error("Certificate is not owned by this test");
    await page.goto("/admin/certificates/new");
    await page.getByRole("textbox", { name: "Tên chứng chỉ" }).fill(name);
    await page.getByRole("textbox", { name: /ID \(kebab-case/ }).fill(id);
    await page
      .getByRole("textbox", { name: "Tổ chức cấp" })
      .fill("Task4 synthetic issuer");
    await page.getByLabel("Ngày cấp").fill("2026-01-01");
    await page
      .getByRole("combobox", { name: "Chủ đề" })
      .selectOption("engineering");
    await page
      .locator('[id="field-description.en"]')
      .fill("Disposable integration certificate");
    await page
      .getByRole("switch", { name: "Hiển thị trên trang", exact: true })
      .uncheck();
    await this.save(page);
    await expect(this.row(id, page)).toBeVisible();
    await expect
      .poll(async () => (await this.read(id))[0]?.published)
      .toBe(false);
  }

  async save(page = this.page) {
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await this.list(page);
  }

  async api(
    path: string,
    options: {
      method?: string;
      data?: unknown;
      access?: Access;
      anonymous?: boolean;
    } = {},
  ) {
    if (!/^\/rest\/v1\/certificates(?:\?[^#\r\n]*)?$/.test(path))
      throw new Error("Only local certificate probes are authorized");
    const access = options.access ?? this.adminAccess;
    if (!access)
      throw new Error("UI authentication is required before backend probes");
    const response = await this.page
      .context()
      .request.fetch(`${this.settings.apiUrl}${path}`, {
        method: options.method ?? "GET",
        headers: {
          apikey: access.apiKey,
          Authorization: `Bearer ${options.anonymous ? access.apiKey : access.token}`,
          Prefer: "return=representation",
        },
        data: options.data,
        maxRedirects: 0,
        timeout: 10_000,
      });
    return response;
  }

  async read(
    id: string,
    options: { access?: Access; anonymous?: boolean } = {},
  ): Promise<CertificateRow[]> {
    const response = await this.api(
      `/rest/v1/certificates?id=eq.${encodeURIComponent(id)}&select=*`,
      options,
    );
    if (!response.ok()) throw new Error("Local certificate read failed");
    const result = certificateRowsSchema.safeParse(await response.json());
    if (!result.success || result.data.some((row) => row.id !== id))
      throw new Error("Unexpected disposable certificate response schema");
    return result.data;
  }

  async remove(id: string, page = this.page) {
    if (!this.ownedIds.has(id))
      throw new Error("Certificate is not owned by this test");
    const row = this.row(id, page);
    await row.getByRole("button", { name: /^Xóa / }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Xóa", exact: true }).click();
    await expect.poll(async () => (await this.read(id)).length).toBe(0);
    await expect(row).toHaveCount(0);
  }

  async cleanup() {
    if (!this.ownedIds.size) return;
    if (!this.adminAccess)
      throw new Error("Missing admin session for owned cleanup");
    for (const id of this.ownedIds) {
      const response = await this.api(
        `/rest/v1/certificates?id=eq.${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!response.ok())
        throw new Error("Owned local certificate cleanup failed");
      if ((await this.read(id)).length)
        throw new Error("Owned local certificate still exists after cleanup");
    }
  }
}

function safeFailureLocation(stack: string | undefined): string | undefined {
  if (!stack) return;
  const locations = stack.split("\n").flatMap((line) => {
    // Emit only allowlisted basenames and bounded line/column numbers. Never
    // retain an absolute path, function name, raw message or original stack.
    const match =
      /^\s+at .*[/\\]tests[/\\]e2e-admin[/\\](admin-flows\.spec|fixtures|settings)\.ts:([1-9][0-9]{0,5}):([1-9][0-9]{0,4})\)?$/.exec(
        line,
      );
    return match ? [`${match[1]}.ts:${match[2]}:${match[3]}`] : [];
  });
  // The first allowlisted frame is the failing helper, not merely its caller.
  return locations[0];
}

function safeFailureCategory(message: string | undefined) {
  const prefix = message?.replace(/^Error: /, "") ?? "";
  if (prefix.startsWith("browserType.launch:")) return "browser-launch";
  if (prefix.startsWith("browser.newContext:")) return "browser-context";
  if (prefix.startsWith("page.goto:")) return "navigation";
  if (/^(?:expect[(:.]|AssertionError:)/.test(prefix)) return "assertion";
  if (prefix === "Local UI authentication failed") return "auth-response";
  if (
    prefix ===
    "Local authentication did not return the expected synthetic identity"
  )
    return "auth-identity";
  if (prefix === "Browser requests must use the disposable anonymous key")
    return "anon-key";
  if (prefix === "Expected the hidden disposable seed certificates")
    return "seed-fixture";
  if (prefix === "Missing local browser API key") return "auth-api-key-missing";
  if (prefix === "Missing local browser access token")
    return "auth-token-missing";
  if (prefix === "Unexpected local browser identity")
    return "auth-email-mismatch";
  if (prefix === "Unexpected local browser user role")
    return "auth-role-mismatch";
  if (
    prefix.startsWith(
      "Task4 browser environment contains forbidden settings",
    ) ||
    prefix.startsWith(
      "Task4 requires an explicit owned local app and valid private fixture",
    )
  )
    return "settings";
  return "other";
}

export function suppressPrivateFailures(
  testInfo: Pick<TestInfo, "errors" | "annotations" | "attachments">,
) {
  for (const error of testInfo.errors) {
    const source = safeFailureLocation(error.stack);
    const category = safeFailureCategory(error.message);
    for (const key of Object.keys(error))
      delete (error as Record<string, unknown>)[key];
    error.message = "Task4 failure; private diagnostics suppressed";
    for (const [type, description] of [
      ["task4-source", source],
      ["task4-category", category],
    ] as const) {
      if (
        description &&
        !testInfo.annotations.some(
          (annotation) =>
            annotation.type === type && annotation.description === description,
        )
      )
        testInfo.annotations.push({ type, description });
    }
  }
  testInfo.attachments.splice(0);
}

export const test = base.extend<{
  suite: AdminHarness;
  _privateFailures: void;
}>({
  // The auto fixture tears down before Playwright's artifact recorder. Retain
  // failure status, but erase errors/call logs that could contain filled passwords,
  // headers, cookies or a signed-in DOM. Titles are fixed strings in the spec.
  _privateFailures: [
    async ({}, provide, testInfo) => {
      try {
        await provide();
      } finally {
        suppressPrivateFailures(testInfo);
      }
    },
    { auto: true, box: true },
  ],
  suite: async ({ page, context }, provide) => {
    const settings = readTask4Settings();
    const harness = new AdminHarness(settings, page);
    let unexpectedDestination = false;
    context.on("request", (request) => {
      const url = new URL(request.url());
      if (![settings.appOrigin, settings.apiUrl].includes(url.origin))
        unexpectedDestination = true;
    });
    context.on("page", (newPage) => harness.observe(newPage));
    harness.observe(page);
    try {
      await provide(harness);
    } finally {
      await context.setOffline(false);
      await harness.cleanup();
      if (unexpectedDestination)
        throw new Error("Unexpected destination in local browser suite");
    }
  },
});

export { expect };
