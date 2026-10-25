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

test("launcher grants the reviewer before backend checks and revokes and re-verifies before claiming real services", () => {
  const source = readFileSync(
    new URL("../../scripts/ci/run-admin-integration.mjs", import.meta.url),
    "utf8",
  );
  const order = [
    "await seedAdmin(",
    "changeReviewerAccess(ownership.databaseId, reviewerGrantSql, env)",
    "JSON.stringify(browserFixture(fixture))",
    "delete status.SERVICE_ROLE_KEY",
    "delete status.JWT_SECRET",
    "await verifyAdminBackend(fixture, status.ANON_KEY)",
    "changeReviewerAccess(ownership.databaseId, reviewerRevokeSql, env)",
    "await verifyReviewerRevoked(",
    "report.realServicesVerified = true",
    'run("npm", ["run", "build"]',
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
  // The full fixture (with reviewer credentials) is never written for the browser.
  assert.ok(!source.includes("JSON.stringify(fixture)"));
  // psql output is checked, never copied into the report or console.
  assert.ok(source.includes("assertSingleRowChange("));
});
