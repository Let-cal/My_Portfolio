import test from "node:test";
import assert from "node:assert/strict";
const url = new URL("../../scripts/ci/backend-progress.mjs", import.meta.url);
const api = await import(url.href).catch((e) => {
  if (e.code === "ERR_MODULE_NOT_FOUND" && e.url === url.href) return {};
  throw e;
});

test("backend diagnostics retain only fixed checkpoint and verified count", () => {
  assert.equal(typeof api.backendFailure, "function");
  assert.equal(typeof api.projectBackendFailure, "function");
  const original = new Error("SECRET-SENTINEL");
  const error = api.backendFailure("auth-admin", 0, original);
  assert.deepEqual(api.projectBackendFailure(error), {
    checkpoint: "auth-admin",
    completedChecks: 0,
    category: "request-failed",
  });
  assert.ok(!JSON.stringify(error).includes("SECRET-SENTINEL"));
  assert.ok(!String(error).includes("SECRET-SENTINEL"));
  assert.equal(error.cause, undefined);
});

test("unknown checkpoints and arbitrary credential fields never reach artifacts", () => {
  for (const error of [
    new Error("SECRET-SENTINEL"),
    {
      code: "TASK4_BACKEND_FAILURE",
      checkpoint: "SECRET-SENTINEL",
      completedChecks: 2,
      category: "request-failed",
    },
    {
      code: "TASK4_BACKEND_FAILURE",
      checkpoint: "auth-admin",
      completedChecks: -1,
      category: "request-failed",
    },
    {
      code: "TASK4_BACKEND_FAILURE",
      checkpoint: "auth-admin",
      completedChecks: 2,
      category: "SECRET-SENTINEL",
    },
  ])
    assert.equal(api.projectBackendFailure?.(error), undefined);
  const projected = api.projectBackendFailure?.({
    code: "TASK4_BACKEND_FAILURE",
    checkpoint: "storage-member-denial",
    completedChecks: 17,
    category: "assertion-failed",
    password: "SECRET-SENTINEL",
    message: "SECRET-SENTINEL",
    actual: { token: "SECRET-SENTINEL" },
  });
  assert.deepEqual(projected, {
    checkpoint: "storage-member-denial",
    completedChecks: 17,
    category: "assertion-failed",
  });
});

test("all declared checkpoints are projectable and counts remain bounded", () => {
  assert.ok(Array.isArray(api.backendCheckpoints));
  assert.equal(
    new Set(api.backendCheckpoints).size,
    api.backendCheckpoints.length,
  );
  for (const checkpoint of api.backendCheckpoints) {
    const error = api.backendFailure(checkpoint, 1, { code: "ERR_ASSERTION" });
    assert.deepEqual(api.projectBackendFailure(error), {
      checkpoint,
      completedChecks: 1,
      category: "assertion-failed",
    });
  }
  for (const count of [NaN, Infinity, 1.1, -1, 101])
    assert.equal(
      api.projectBackendFailure({
        code: "TASK4_BACKEND_FAILURE",
        checkpoint: "auth-admin",
        category: "request-failed",
        completedChecks: count,
      }),
      undefined,
    );
});
