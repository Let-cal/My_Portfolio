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

test("reviewer and revocation checkpoints are allowlisted alongside the existing labels", () => {
  const reviewerLabels = [
    "auth-reviewer",
    "access-kind",
    "hidden-reviewer",
    "insert-reviewer-denial",
    "public-reviewer",
    "update-reviewer-denial",
    "update-reviewer-integrity",
    "delete-reviewer-denial",
    "delete-reviewer-integrity",
    "private-schema-reviewer-denial",
    "history-reviewer",
    "restore-reviewer-denial",
    "storage-reviewer-list",
    "storage-reviewer-denial",
    "storage-reviewer-remove-denial",
    "storage-reviewer-remove-integrity",
    "storage-reviewer-move-denial",
    "storage-reviewer-move-integrity",
    "realtime-reviewer-join",
    "realtime-reviewer-send-denial",
    "realtime-reviewer-http-send-denial",
    "realtime-reviewer-send-silence",
    "revoked-reviewer-auth",
    "revoked-reviewer-access-kind",
    "revoked-reviewer-hidden",
  ];
  for (const label of reviewerLabels)
    assert.ok(api.backendCheckpoints.includes(label), label);
  // 31 pre-reviewer labels are kept; 25 reviewer/revocation labels are added.
  assert.equal(api.backendCheckpoints.length, 31 + reviewerLabels.length);
  assert.ok(Object.isFrozen(api.backendCheckpoints));
});

test("every literal checkpoint assigned by the backend verifier is allowlisted", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../scripts/ci/verify-admin-backend.mjs", import.meta.url),
    "utf8",
  );
  const assigned = new Set();
  for (const [, expression] of source.matchAll(/checkpoint\s*=([^;]+);/g))
    for (const [, label] of expression.matchAll(/"([^"]+)"/g))
      assigned.add(label);
  assert.ok(assigned.size >= 30);
  for (const label of assigned)
    assert.ok(api.backendCheckpoints.includes(label), label);
  // Map-driven labels are not literal checkpoint assignments; pin them separately.
  for (const label of ["auth-admin", "auth-member", "auth-reviewer"])
    assert.ok(source.includes(`"${label}"`), label);
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

test("reviewer write-denial probes run in the reviewer phase, before the live-delivery control", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../scripts/ci/verify-admin-backend.mjs", import.meta.url),
    "utf8",
  );
  const order = [
    'checkpoint = "storage-admin"',
    'checkpoint = "storage-reviewer-denial"',
    'checkpoint = "storage-reviewer-remove-denial"',
    'checkpoint = "storage-reviewer-remove-integrity"',
    'checkpoint = "storage-reviewer-move-denial"',
    'checkpoint = "storage-reviewer-move-integrity"',
    'checkpoint = "realtime-admin-join"',
    'checkpoint = "realtime-reviewer-join"',
    'checkpoint = "realtime-reviewer-send-denial"',
    'checkpoint = "realtime-reviewer-http-send-denial"',
    'checkpoint = "realtime-reviewer-send-silence"',
    "await reviewer.removeChannel(reviewerChannel)",
    // The admin listener must still receive the real change note afterwards.
    'checkpoint = "realtime-delivery"',
    "export async function verifyReviewerRevoked",
  ].map((needle) => {
    const index = source.indexOf(needle);
    assert.notEqual(index, -1, needle);
    assert.equal(source.indexOf(needle, index + 1), -1, `duplicate ${needle}`);
    return index;
  });
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
  );
});
