import test from "node:test";
import assert from "node:assert/strict";

const url = new URL("../../scripts/ci/backend-denial.mjs", import.meta.url);
const api = await import(url.href).catch((error) => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && error.url === url.href)
    return {};
  throw error;
});

const transportErrors = [
  null,
  undefined,
  new TypeError("fetch failed"),
  { code: "", message: "TypeError: fetch failed" },
  { code: "ECONNREFUSED", message: "connect ECONNREFUSED" },
  { code: "PGRST000", message: "database unavailable" },
  {
    code: "PGRST202",
    message: "Could not find the function in the schema cache",
  },
  { code: "42883", message: "function does not exist" },
  { status: 503, message: "Service unavailable" },
];

for (const [name, allowed, rejected] of [
  [
    "isPrivateSchemaDenied",
    { code: "PGRST106", message: "Invalid schema: private" },
    [{ code: "42501", message: "permission denied" }, { code: "42P01" }],
  ],
  [
    "isHistoryDenied",
    { code: "42501", message: "not allowed" },
    [{ code: "PGRST106" }, { code: "PGRST301", message: "JWT expired" }],
  ],
  [
    "isRestoreDenied",
    { code: "42501", message: "not allowed" },
    [
      // Reached the version lookup: the admin gate did not deny the caller.
      { code: "P0001", message: "version 0 not found" },
      { code: "P0001", message: "cannot restore skill_links" },
      { code: "PGRST106" },
      { code: "PGRST301", message: "JWT expired" },
      { code: "42501 " },
      { code: 42501 },
    ],
  ],
]) {
  test(`${name} accepts only its explicit server denial`, () => {
    assert.equal(api[name]?.(allowed), true);
  });
  for (const [index, error] of [...transportErrors, ...rejected].entries()) {
    test(`${name} rejects unrelated or infrastructure error ${index}`, () => {
      assert.equal(api[name]?.(error), false);
    });
  }
}

test("storage RLS denial uses payload statusCode even when HTTP status is 400", () => {
  assert.equal(
    api.isStorageUploadDenied?.({
      name: "StorageApiError",
      status: 400,
      statusCode: "403",
      message: "new row violates row-level security policy",
    }),
    true,
  );
  assert.equal(
    api.isStorageUploadDenied?.({
      status: 403,
      statusCode: 403,
      message: "new row violates row-level security policy",
    }),
    true,
  );
});
for (const [index, error] of [
  ...transportErrors,
  { status: 400, statusCode: "400", message: "Bucket not found" },
  { status: 404, statusCode: "404", message: "Bucket not found" },
  { status: 409, statusCode: "409", message: "The resource already exists" },
  { statusCode: "403", message: "Invalid JWT" },
  { status: 403, message: "Forbidden" },
  { statusCode: "503", message: "new row violates row-level security policy" },
].entries()) {
  test(`storage rejects unrelated or infrastructure error ${index}`, () => {
    assert.equal(api.isStorageUploadDenied?.(error), false);
  });
}

const deniedReason =
  "Unauthorized: You do not have permissions to read from this Channel topic: admin:content";
test("Realtime denial requires CHANNEL_ERROR and the server topic authorization reason", () => {
  assert.equal(
    api.isRealtimeJoinDenied?.(
      "CHANNEL_ERROR",
      new Error(deniedReason, {
        cause: { reason: deniedReason },
      }),
    ),
    true,
  );
});
for (const [index, [status, error]] of [
  ["SUBSCRIBED", undefined],
  ["SUBSCRIBED", new Error(deniedReason)],
  ["TIMED_OUT", new Error(deniedReason)],
  ["CLOSED", new Error(deniedReason)],
  ["CHANNEL_ERROR", undefined],
  ["CHANNEL_ERROR", new Error("channel error: transport failure")],
  ["CHANNEL_ERROR", new Error("socket closed: 1006")],
  [
    "CHANNEL_ERROR",
    new Error("Realtime was unable to connect to the project database"),
  ],
  ["CHANNEL_ERROR", new Error("Node request timeout")],
  ["CHANNEL_ERROR", new Error("InvalidJWTToken")],
  ["CHANNEL_ERROR", new Error("UnableToSetPolicies")],
  [
    "CHANNEL_ERROR",
    new Error(
      "You do not have permissions to read from this Channel topic: admin:content",
    ),
  ],
  [
    "CHANNEL_ERROR",
    new Error(
      "Unauthorized: You do not have permissions to read from this Channel topic: other",
    ),
  ],
].entries()) {
  test(`Realtime rejects success, timeout or unrelated channel error ${index}`, () => {
    assert.equal(api.isRealtimeJoinDenied?.(status, error), false);
  });
}

const rlsDenial = {
  name: "StorageApiError",
  status: 400,
  statusCode: "403",
  message: "new row violates row-level security policy",
};
const updateFilteredDenial = {
  name: "StorageApiError",
  status: 400,
  statusCode: "404",
  message: "Object not found",
};
test("storage move denial accepts the RLS violation or the RLS-filtered update", () => {
  assert.equal(api.isStorageMoveDenied?.(rlsDenial), true);
  assert.equal(api.isStorageMoveDenied?.(updateFilteredDenial), true);
  assert.equal(
    api.isStorageMoveDenied?.({ statusCode: 404, message: "Object not found" }),
    true,
  );
});
for (const [index, error] of [
  ...transportErrors,
  { statusCode: "404", message: "Bucket not found" },
  { statusCode: "400", message: "Object not found" },
  { status: 404, message: "Object not found" },
  { statusCode: "403", message: "Invalid JWT" },
  { statusCode: "409", message: "The resource already exists" },
].entries()) {
  test(`storage move rejects unrelated or infrastructure error ${index}`, () => {
    assert.equal(api.isStorageMoveDenied?.(error), false);
  });
}

test("storage remove denial accepts an empty RLS-filtered delete or a denial error", () => {
  assert.equal(api.isStorageRemoveDenied?.({ data: [], error: null }), true);
  assert.equal(
    api.isStorageRemoveDenied?.({ data: null, error: rlsDenial }),
    true,
  );
  assert.equal(
    api.isStorageRemoveDenied?.({ data: null, error: updateFilteredDenial }),
    true,
  );
});
for (const [index, result] of [
  undefined,
  null,
  {},
  // Something was deleted: never a denial, whatever else the response says.
  { data: [{ name: "images/test-item-backend-1.png" }], error: null },
  { data: [{}], error: null },
  { data: null, error: null },
  { data: {}, error: null },
  { data: [], error: undefined },
  { data: [{ name: "x" }], error: rlsDenial },
  ...transportErrors.map((error) => ({ data: null, error })),
  { data: null, error: { statusCode: "403", message: "Invalid JWT" } },
].entries()) {
  test(`storage remove rejects deletion, empty or infrastructure result ${index}`, () => {
    assert.equal(api.isStorageRemoveDenied?.(result), false);
  });
}

test("broadcast ack is withheld only on timeout or error reply", () => {
  assert.equal(api.isBroadcastAckWithheld?.("timed out"), true);
  assert.equal(api.isBroadcastAckWithheld?.("error"), true);
});
for (const [index, result] of [
  "ok",
  "OK",
  "",
  "timeout",
  undefined,
  null,
  { status: "error" },
].entries()) {
  test(`broadcast ack rejects relayed or unknown send result ${index}`, () => {
    assert.equal(api.isBroadcastAckWithheld?.(result), false);
  });
}

test("broadcast httpSend counts a 202 or an explicit authorization rejection as answered", () => {
  for (const outcome of [
    { status: "fulfilled", value: { success: true } },
    { status: "rejected", reason: new Error("Unauthorized") },
    { status: "rejected", reason: new Error("Forbidden") },
    {
      status: "rejected",
      reason: new Error(
        "You do not have permissions to write to this Channel topic: admin:content",
      ),
    },
  ])
    assert.equal(api.isBroadcastHttpAnswered?.(outcome), true);
});
const timeout = new Error("The operation was aborted due to timeout");
timeout.name = "TimeoutError";
for (const [index, outcome] of [
  undefined,
  null,
  {},
  { status: "fulfilled" },
  { status: "fulfilled", value: { success: false } },
  { status: "fulfilled", value: { success: "true" } },
  { status: "rejected" },
  { status: "rejected", reason: "Unauthorized" },
  { status: "rejected", reason: { message: "Unauthorized" } },
  { status: "rejected", reason: new TypeError("fetch failed") },
  { status: "rejected", reason: new TypeError("Unauthorized") },
  { status: "rejected", reason: timeout },
  { status: "rejected", reason: new Error("Internal Server Error") },
  {
    status: "rejected",
    reason: new Error("Nonlocal integration request denied"),
  },
  {
    status: "rejected",
    reason: new Error(
      "httpSend() requires Realtime server v2.97.0 or newer; the endpoint returned 404.",
    ),
  },
  { status: "rejected", reason: new Error("Unauthorized: invalid JWT") },
  { status: "rejected", reason: new Error("Unauthorized: token has expired") },
].entries()) {
  test(`broadcast httpSend rejects transport, timeout or unrelated outcome ${index}`, () => {
    assert.equal(api.isBroadcastHttpAnswered?.(outcome), false);
  });
}
