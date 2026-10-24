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
