import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
test("real launcher refuses non-owned environments before any service operation", () => {
  const entry = fileURLToPath(
    new URL("../../scripts/ci/run-admin-integration.mjs", import.meta.url),
  );
  const r = spawnSync(process.execPath, [entry], {
    env: { PATH: process.env.PATH ?? "" },
    encoding: "utf8",
    timeout: 10000,
  });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /BLOCKED; phase=bootstrap/);
  assert.equal(r.stderr, "");
  const result = JSON.parse(
    readFileSync(
      new URL("../../reports/admin-integration-summary.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(result.realServicesVerified, false);
  assert.equal(result.status, "BLOCKED");
  assert.ok(Number.isSafeInteger(result.totalMs) && result.totalMs >= 0);
});
