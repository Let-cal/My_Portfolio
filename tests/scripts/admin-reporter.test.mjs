import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import AdminReporter, {
  adminSummary,
  projectAdminSummary,
} from "../../scripts/ci/admin-reporter.mjs";

const meta = { revision: "a".repeat(40), runId: "123", attempt: "1" };
// Independent expectations: replacing a mandatory title invalidates evidence.
const titles = [
  "local authentication, logout and anonymous/member denial",
  "certificate CRUD, public visibility and persisted keyboard ordering",
  "a local draft survives reload, restores and clears after a real save",
  "two tabs receive real updates, retain conflicting edits and notice deletion",
  "cross-tab signout preserves the form and real reauthentication resumes saving",
  "network simulation: offline edits recover and save to the real backend",
];
const selected = ["auth", "crud", "drafts", "realtime", "session", "offline"];
const executions = {
  auth: 1,
  crud: 1,
  drafts: 1,
  realtime: 1,
  session: 1,
  offline: 1,
};
const file = fileURLToPath(
  new URL("../e2e-admin/admin-flows.spec.ts", import.meta.url),
);
const discovered = () =>
  titles.map((title, i) => ({
    testId: `test-${i}`,
    title,
    file,
    project: "task4-local-chrome",
    expectedStatus: "passed",
  }));
const rows = () =>
  discovered().map((identity) => ({ ...identity, status: "passed", retry: 0 }));
const summarize = (
  records = rows(),
  selection = discovered(),
  status = "passed",
  metadata = meta,
) => adminSummary(records, selection.length, status, metadata, selection);

test("all six exact identities pass once with current run metadata and safe evidence", () => {
  assert.deepEqual(summarize(), {
    version: 1,
    status: "PASS",
    expected: 6,
    attempts: 6,
    passed: 6,
    rejected: 0,
    selected,
    executions,
    revision: meta.revision,
    runId: meta.runId,
    runAttempt: meta.attempt,
  });
  assert.equal(
    summarize(rows().reverse(), discovered().reverse()).status,
    "PASS",
  );
});

test("six passing replacements, duplicates and wrong file/project cannot satisfy discovery", () => {
  const mutations = [
    (r) => {
      r[0].title = "SECRET-SENTINEL replacement";
    },
    (r) => {
      r[0] = { ...r[1], testId: r[0].testId };
    },
    (r) => {
      r[0].testId = r[1].testId;
    },
    (r) => {
      r[0].file = join(tmpdir(), "admin-flows.spec.ts");
    },
    (r) => {
      r[0].file = "admin-flows.spec.ts";
    },
    (r) => {
      r[0].project = "public-chromium";
    },
    (r) => {
      r[0].expectedStatus = "skipped";
    },
  ];
  for (const mutate of mutations) {
    const selection = discovered();
    mutate(selection);
    const result = summarize(
      selection.map((r) => ({ ...r, status: "passed", retry: 0 })),
      selection,
    );
    assert.equal(result.status, "FAIL");
    assert.ok(!JSON.stringify(result).includes("SECRET-SENTINEL"));
  }
  assert.equal(adminSummary(rows(), 6, "passed", meta).status, "FAIL");
  assert.equal(summarize(rows(), discovered().slice(1)).status, "FAIL");
  assert.equal(
    summarize(rows(), [
      ...discovered(),
      { ...discovered()[0], testId: "extra" },
    ]).status,
    "FAIL",
  );
});

test("executions must uniquely match discovered identity, file, project and test ID", () => {
  const mutations = [
    (r) => {
      r[0] = { ...r[1] };
    },
    (r) => {
      r[0].testId = "undiscovered";
    },
    (r) => {
      r[0].title = "unexpected SECRET-SENTINEL";
    },
    (r) => {
      r[0].file = join(tmpdir(), "admin-flows.spec.ts");
    },
    (r) => {
      r[0].project = "other";
    },
  ];
  for (const mutate of mutations) {
    const records = rows();
    mutate(records);
    const result = summarize(records);
    assert.equal(result.status, "FAIL");
    assert.ok(!JSON.stringify(result).includes("SECRET-SENTINEL"));
  }
  assert.equal(summarize(rows().slice(1)).status, "FAIL");
  assert.equal(summarize([...rows(), rows()[0]]).status, "FAIL");
});

test("failed, skipped, expected failures, interruptions and retries never pass", () => {
  for (const status of ["failed", "skipped", "interrupted", "timedOut"]) {
    const records = rows();
    records[0].status = status;
    assert.equal(summarize(records).status, "FAIL");
  }
  for (const patch of [
    { retry: 1 },
    { retry: undefined },
    { expectedStatus: "failed" },
  ]) {
    const records = rows();
    Object.assign(records[0], patch);
    assert.equal(summarize(records).status, "FAIL");
  }
  assert.equal(summarize(rows(), discovered(), "failed").status, "FAIL");
  assert.equal(summarize([], []).status, "FAIL");
  for (const patch of [
    { revision: "SECRET-SENTINEL" },
    { runId: "0" },
    { attempt: "SECRET-SENTINEL" },
  ]) {
    const result = summarize(rows(), discovered(), "passed", {
      ...meta,
      ...patch,
    });
    assert.equal(result.status, "FAIL");
    assert.ok(!JSON.stringify(result).includes("SECRET-SENTINEL"));
  }
});

test("summary omits raw titles, test IDs, credentials, errors and caller metadata", () => {
  const records = rows();
  records[0].error = { message: "SECRET-SENTINEL" };
  const result = summarize(records, discovered(), "passed", {
    ...meta,
    password: "SECRET-SENTINEL",
  });
  const json = JSON.stringify(result);
  assert.ok(!json.includes("SECRET-SENTINEL"));
  assert.ok(!json.includes(titles[0]));
  assert.ok(!json.includes("test-0"));
});

test("projection validates exact manifest identities after JSON read and drops unknown secrets", () => {
  const source = JSON.parse(
    JSON.stringify({
      ...summarize(),
      authState: "SECRET-SENTINEL",
      errors: ["SECRET-SENTINEL"],
    }),
  );
  assert.deepEqual(projectAdminSummary(source, meta), summarize());
  const projected = projectAdminSummary(source, meta);
  assert.notEqual(projected.selected, source.selected);
  assert.notEqual(projected.executions, source.executions);
  assert.ok(!JSON.stringify(projected).includes("SECRET-SENTINEL"));
  const mutations = [
    (r) => {
      delete r.selected;
    },
    (r) => {
      r.selected[0] = "SECRET-SENTINEL";
    },
    (r) => {
      r.selected[0] = r.selected[1];
    },
    (r) => {
      r.selected.push("SECRET-SENTINEL");
    },
    (r) => {
      delete r.executions;
    },
    (r) => {
      delete r.executions.auth;
    },
    (r) => {
      r.executions.auth = 2;
    },
    (r) => {
      r.executions["SECRET-SENTINEL"] = 1;
    },
    (r) => {
      r.executions.auth = "1";
    },
    (r) => {
      r.passed = 5;
    },
    (r) => {
      r.revision = "b".repeat(40);
    },
    (r) => {
      r.runId = "124";
    },
    (r) => {
      r.runAttempt = "2";
    },
  ];
  for (const mutate of mutations) {
    const report = JSON.parse(JSON.stringify(source));
    mutate(report);
    assert.throws(
      () => projectAdminSummary(report, meta),
      (error) => {
        assert.ok(!error.message.includes("SECRET-SENTINEL"));
        return true;
      },
    );
  }
  assert.throws(() =>
    projectAdminSummary(
      { ...source, runId: "SECRET-SENTINEL" },
      { ...meta, runId: "SECRET-SENTINEL" },
    ),
  );
  assert.equal(
    projectAdminSummary(
      { ...source, status: "FAIL", passed: 5, rejected: 1 },
      meta,
    ).status,
    "FAIL",
  );
});

test("projection rejects a malicious unknown identity even when all counts claim PASS", () => {
  const source = {
    ...summarize(),
    selected: ["SECRET-SENTINEL", ...selected.slice(1)],
    executions,
  };
  assert.throws(
    () => projectAdminSummary(source, meta),
    (error) => {
      assert.ok(!error.message.includes("SECRET-SENTINEL"));
      return true;
    },
  );
});

test("reporter lifecycle binds discovery to callbacks and writes only sanitized evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "admin-reporter-"));
  const env = {
    TASK4_BROWSER_SUMMARY: join(dir, "summary.json"),
    TASK4_REVISION: meta.revision,
    TASK4_RUN_ID: meta.runId,
    TASK4_RUN_ATTEMPT: meta.attempt,
  };
  const previous = Object.fromEntries(
    Object.keys(env).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, env);
  const tests = discovered().map((r) => ({
    id: r.testId,
    title: r.title,
    location: { file: r.file },
    expectedStatus: r.expectedStatus,
    parent: { project: () => ({ name: r.project }) },
  }));
  const run = (selection, actual = selection, error = false) => {
    const reporter = new AdminReporter();
    reporter.onBegin({}, { allTests: () => selection });
    for (const entry of actual)
      reporter.onTestEnd(entry, {
        status: "passed",
        retry: 0,
        errors: [{ message: "SECRET-SENTINEL" }],
      });
    if (error) reporter.onError(new Error("SECRET-SENTINEL"));
    const end = reporter.onEnd({ status: "passed" });
    const raw = readFileSync(env.TASK4_BROWSER_SUMMARY, "utf8");
    assert.ok(!raw.includes("SECRET-SENTINEL"));
    return { end, report: JSON.parse(raw) };
  };
  try {
    const valid = run(tests);
    assert.equal(valid.end, undefined);
    assert.deepEqual(projectAdminSummary(valid.report, meta), summarize());
    for (const result of [
      run(tests, tests.slice(1)),
      run(tests, [...tests.slice(1), tests[1]]),
      run(tests, tests, true),
      run([{ ...tests[0], title: "SECRET-SENTINEL" }, ...tests.slice(1)]),
      run(tests, [{ ...tests[0], id: "SECRET-SENTINEL" }, ...tests.slice(1)]),
    ]) {
      assert.deepEqual(result.end, { status: "failed" });
      assert.equal(result.report.status, "FAIL");
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
