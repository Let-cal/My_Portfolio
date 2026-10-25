import test from "node:test";
import assert from "node:assert/strict";
const url = new URL("../../scripts/ci/seed-admin.mjs", import.meta.url);
const api = await import(url.href).catch((e) => {
  if (e.code === "ERR_MODULE_NOT_FOUND" && e.url === url.href) return {};
  throw e;
});
test("synthetic seed is explicit and contains no recruiter content or production URL", () => {
  assert.equal(typeof api.syntheticRows, "function");
  const rows = api.syntheticRows();
  assert.equal(rows.profile.id, "me");
  assert.equal(rows.profile.email, "task4-public@example.invalid");
  assert.equal(rows.roles.length, 3);
  assert.deepEqual(
    rows.certificates.map((c) => c.id),
    ["task4-certificate-a", "task4-certificate-b", "task4-certificate-public"],
  );
  assert.deepEqual(
    rows.certificates.filter((c) => !c.published).map((c) => c.id),
    ["task4-certificate-a", "task4-certificate-b"],
  );
  assert.ok(!JSON.stringify(rows).includes("supabase.co"));
  assert.ok(!JSON.stringify(rows).includes("letcal"));
});

test("public write-denial control is a separate published synthetic certificate", () => {
  const certificates = api.syntheticRows().certificates;
  const publicRows = certificates.filter((c) => c.published);
  assert.equal(publicRows.length, 1);
  assert.equal(publicRows[0].id, "task4-certificate-public");
  assert.equal(publicRows[0].name, "test-item public");
  assert.equal(publicRows[0].organization, "Synthetic issuer");
});
test("fixture provisioning refuses hosted destinations before loading an SDK client", async () => {
  assert.equal(typeof api.seedAdmin, "function");
  await assert.rejects(
    api.seedAdmin({
      apiUrl: "https://hosted.supabase.co",
      serviceRoleKey: "sentinel",
      runId: "123",
    }),
  );
});

test("seed provisions exactly the admin, member and reviewer synthetic identities", () => {
  assert.deepEqual(api.syntheticIdentityKinds, ["admin", "member", "reviewer"]);
  assert.ok(Object.isFrozen(api.syntheticIdentityKinds));
});

test("browser fixture keeps the strict browser shape and drops reviewer credentials", () => {
  assert.equal(typeof api.browserFixture, "function");
  const fixture = {
    version: 1,
    runId: "123",
    apiUrl: "http://127.0.0.1:55321",
    admin: { email: "task4-admin@example.invalid", password: "a".repeat(32) },
    member: { email: "task4-member@example.invalid", password: "b".repeat(32) },
    reviewer: {
      email: "task4-reviewer@example.invalid",
      password: "SECRET-SENTINEL",
    },
    fixtures: {
      certificateIds: ["task4-certificate-a", "task4-certificate-b"],
    },
  };
  const projected = api.browserFixture(fixture);
  assert.deepEqual(Object.keys(projected), [
    "version",
    "runId",
    "apiUrl",
    "admin",
    "member",
    "fixtures",
  ]);
  assert.deepEqual(projected.admin, fixture.admin);
  assert.deepEqual(projected.member, fixture.member);
  assert.ok(!JSON.stringify(projected).includes("SECRET-SENTINEL"));
  assert.ok(!JSON.stringify(projected).includes("reviewer"));
  // Unknown future fields are not forwarded either.
  assert.equal(api.browserFixture({ ...fixture, extra: "x" }).extra, undefined);
});
