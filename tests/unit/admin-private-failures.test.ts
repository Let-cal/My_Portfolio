import { describe, expect, it } from "vitest";
import { suppressPrivateFailures } from "../e2e-admin/fixtures";

describe("bounded private browser failure diagnostics", () => {
  it.each([
    ["browserType.launch: SECRET-SENTINEL", "browser-launch"],
    ["Error: browserType.launch: SECRET-SENTINEL", "browser-launch"],
    ["browser.newContext: SECRET-SENTINEL", "browser-context"],
    ["page.goto: SECRET-SENTINEL", "navigation"],
    [
      "Error: expect(locator).toBeVisible() failed SECRET-SENTINEL",
      "assertion",
    ],
    ["expect(received).toBe(expected) SECRET-SENTINEL", "assertion"],
    ["AssertionError: SECRET-SENTINEL", "assertion"],
    ["Task4 browser environment contains forbidden settings", "settings"],
    ["Local UI authentication failed", "auth-response"],
    [
      "Local authentication did not return the expected synthetic identity",
      "auth-identity",
    ],
    ["Browser requests must use the disposable anonymous key", "anon-key"],
    ["Expected the hidden disposable seed certificates", "seed-fixture"],
    ["Missing local browser API key", "auth-api-key-missing"],
    ["Missing local browser access token", "auth-token-missing"],
    ["Unexpected local browser identity", "auth-email-mismatch"],
    ["Unexpected local browser user role", "auth-role-mismatch"],
    [
      "Task4 requires an explicit owned local app and valid private fixture",
      "settings",
    ],
    ["SECRET-SENTINEL browserType.launch:", "other"],
    ["SECRET-SENTINEL", "other"],
    [undefined, "other"],
  ])(
    "classifies a private prefix into %s without retaining its content",
    (message, category) => {
      const error = {
        message,
        stack: "SECRET-SENTINEL",
        originalError: { secret: "SECRET-SENTINEL" },
        cause: { message: "SECRET-SENTINEL" },
        value: "SECRET-SENTINEL",
      };
      const info = { errors: [error], annotations: [], attachments: [] };
      suppressPrivateFailures(info);
      expect(info.annotations).toEqual([
        { type: "task4-category", description: category },
      ]);
      expect(Object.keys(error)).toEqual(["message"]);
      expect(JSON.stringify(info)).not.toContain("SECRET-SENTINEL");
    },
  );

  it("keeps the allowlisted source and category before erasing errors and attachments", () => {
    const info = {
      errors: [
        {
          message: "expect(received).toBe(expected) SECRET-SENTINEL",
          stack:
            "SECRET-SENTINEL\n    at fn (/SECRET-SENTINEL/tests/e2e-admin/fixtures.ts:20:3)\n    at fn (/SECRET-SENTINEL/tests/e2e-admin/admin-flows.spec.ts:31:7)",
          cause: { message: "SECRET-SENTINEL" },
        },
      ],
      annotations: [] as { type: string; description?: string }[],
      attachments: [
        {
          name: "SECRET-SENTINEL",
          contentType: "text/plain",
          body: Buffer.from("SECRET-SENTINEL"),
        },
      ],
    };
    suppressPrivateFailures(info);
    expect(info.annotations).toEqual([
      { type: "task4-source", description: "fixtures.ts:20:3" },
      { type: "task4-category", description: "assertion" },
    ]);
    expect(info.attachments).toEqual([]);
    expect(JSON.stringify(info)).not.toContain("SECRET-SENTINEL");
  });
});
