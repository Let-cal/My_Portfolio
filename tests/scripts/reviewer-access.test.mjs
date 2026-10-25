import test from "node:test";
import assert from "node:assert/strict";
const url = new URL("../../scripts/ci/reviewer-access.mjs", import.meta.url);
const api = await import(url.href).catch((e) => {
  if (e.code === "ERR_MODULE_NOT_FOUND" && e.url === url.href) return {};
  throw e;
});

test("reviewer grant/revoke SQL is fixed, targets only the synthetic reviewer and reports a count", () => {
  assert.equal(api.reviewerEmail, "task4-reviewer@example.invalid");
  for (const sql of [api.reviewerGrantSql, api.reviewerRevokeSql]) {
    assert.equal(typeof sql, "string");
    assert.ok(sql.includes("private.app_reviewers"));
    assert.ok(sql.includes("auth.users"));
    assert.ok(sql.includes("email = 'task4-reviewer@example.invalid'"));
    assert.match(sql, /returning 1\) select count\(\*\) from \w+$/);
    // One statement, no other identity, no role or admin-table change.
    assert.equal(sql.split("'").length, 3);
    assert.ok(!sql.includes(";"));
    assert.ok(!/app_admins|task4-admin|task4-member/.test(sql));
  }
  assert.match(
    api.reviewerGrantSql,
    /^with \w+ as \(insert into private\.app_reviewers\(user_id\) select id from auth\.users where /,
  );
  assert.match(
    api.reviewerRevokeSql,
    /^with \w+ as \(delete from private\.app_reviewers /,
  );
});

test("reviewer access change accepts only exactly one changed row", () => {
  assert.equal(typeof api.assertSingleRowChange, "function");
  for (const output of ["1", "1\n", "1\r\n"])
    assert.doesNotThrow(() => api.assertSingleRowChange(output));
});

for (const [index, output] of [
  "0",
  "0\n",
  "2",
  "",
  "\n",
  "01",
  "1\n1",
  "-1",
  "INSERT 0 1",
  "true",
  undefined,
  null,
  1,
].entries()) {
  test(`reviewer access change fails closed on unexpected psql output ${index}`, () => {
    // A fixed message: psql output is never echoed into the launcher's error.
    assert.throws(() => api.assertSingleRowChange(output), {
      message: "Reviewer access change did not affect exactly one row",
    });
  });
}
