import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const moduleUrl = new URL(
  "../../.github/scripts/playwright-summary.mjs",
  import.meta.url,
);
const api = await import(moduleUrl.href).catch((error) => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
const script = fileURLToPath(moduleUrl);

// Synthetic JSONReport fixtures follow installed Playwright 1.64 reporter types.
// No browser/server or existing report is needed, and no raw CI report is invented.
function attempt(status = "passed", duration = 20, retry = 0) {
  return {
    workerIndex: 0,
    parallelIndex: 0,
    status,
    duration,
    retry,
    errors: [],
    stdout: [],
    stderr: [],
    annotations: [],
    attachments: [],
    startTime: "2026-10-21T00:00:00.000Z",
  };
}
function report() {
  return {
    config: {
      projects: [
        {
          id: "chromium",
          name: "chromium",
          repeatEach: 1,
          retries: 2,
          outputDir: "test-results",
          metadata: {},
          testDir: "tests/e2e",
          testIgnore: [],
          testMatch: ["**/*.spec.ts"],
          timeout: 120000,
        },
      ],
    },
    suites: [
      {
        title: "alpha.spec.ts",
        file: "tests/e2e/alpha.spec.ts",
        line: 0,
        column: 0,
        specs: [
          {
            id: "spec-a",
            title: "loads",
            file: "tests/e2e/alpha.spec.ts",
            line: 3,
            column: 1,
            tags: [],
            ok: true,
            tests: [
              {
                timeout: 120000,
                annotations: [],
                expectedStatus: "passed",
                projectId: "chromium",
                projectName: "chromium",
                status: "expected",
                results: [attempt()],
              },
            ],
          },
        ],
      },
    ],
    errors: [],
    stats: {
      startTime: "2026-10-21T00:00:00.000Z",
      duration: 100,
      expected: 1,
      unexpected: 0,
      flaky: 0,
      skipped: 0,
    },
  };
}
const specOf = (r) => r.suites[0].specs[0];
const testOf = (r) => specOf(r).tests[0];
function summarize(r) {
  assert.equal(
    typeof api.summarizePlaywright,
    "function",
    "summarizePlaywright must be exported",
  );
  return api.summarizePlaywright(r);
}
function outcome(r, status, results, expectedStatus = "passed") {
  Object.assign(testOf(r), { status, results, expectedStatus });
  specOf(r).ok = status !== "unexpected";
  Object.assign(r.stats, {
    expected: 0,
    unexpected: 0,
    flaky: 0,
    skipped: 0,
    [status]: 1,
  });
  return r;
}
function runCli(t, contents, args) {
  const directory = mkdtempSync(join(tmpdir(), "playwright-summary-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "report.json");
  if (contents !== undefined)
    writeFileSync(
      path,
      typeof contents === "string" ? contents : JSON.stringify(contents),
    );
  const result = spawnSync(process.execPath, [script, ...(args ?? [path])], {
    encoding: "utf8",
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  return result;
}

test("returns the exact timing/count API without mutating the report", () => {
  const r = report();
  const before = structuredClone(r);
  assert.deepEqual(summarize(r), {
    durationMs: 100,
    counts: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
    files: [{ file: "tests/e2e/alpha.spec.ts", durationMs: 20, tests: 1 }],
    slowest: [
      {
        file: "tests/e2e/alpha.spec.ts",
        title: "loads",
        outcome: "expected",
        durationMs: 20,
        attempts: 1,
      },
    ],
    errors: [],
  });
  assert.deepEqual(r, before);
});

test("nested suites and merged projects retain every test and summed retry time", () => {
  const r = report();
  const nested = structuredClone(r.suites[0]);
  nested.title = "nested";
  nested.specs[0].id = "spec-b";
  nested.specs[0].title = "retries";
  nested.specs[0].line = 8;
  nested.specs[0].tests[0].status = "flaky";
  nested.specs[0].tests[0].results = [
    attempt("failed", 30),
    attempt("passed", 50, 1),
  ];
  const secondProject = structuredClone(testOf(r));
  secondProject.projectId = secondProject.projectName = "firefox";
  secondProject.results = [attempt("passed", 40)];
  specOf(r).tests.push(secondProject);
  r.config.projects.push({
    ...r.config.projects[0],
    id: "firefox",
    name: "firefox",
  });
  r.suites[0].suites = [nested];
  r.stats.expected = 2;
  r.stats.flaky = 1;
  const summary = summarize(r);
  assert.deepEqual(summary.counts, {
    expected: 2,
    unexpected: 0,
    flaky: 1,
    skipped: 0,
  });
  assert.deepEqual(summary.files, [
    { file: "tests/e2e/alpha.spec.ts", durationMs: 140, tests: 3 },
  ]);
  assert.deepEqual(
    summary.slowest.map(({ title, durationMs, attempts }) => ({
      title,
      durationMs,
      attempts,
    })),
    [
      { title: "nested › retries", durationMs: 80, attempts: 2 },
      { title: "loads", durationMs: 40, attempts: 1 },
      { title: "loads", durationMs: 20, attempts: 1 },
    ],
  );
  assert.equal(summary.durationMs, 100); // Parallel summed test time can exceed elapsed time.
});

test("files sort by summed time and all slow tests remain available", () => {
  const r = report();
  const second = structuredClone(r.suites[0]);
  second.file = second.specs[0].file = "tests/e2e/beta.spec.ts";
  second.title = "beta.spec.ts";
  second.specs[0].id = "spec-b";
  second.specs[0].tests[0].results[0].duration = 90;
  r.suites.push(second);
  r.stats.expected = 2;
  assert.deepEqual(summarize(r).files, [
    { file: "tests/e2e/beta.spec.ts", durationMs: 90, tests: 1 },
    { file: "tests/e2e/alpha.spec.ts", durationMs: 20, tests: 1 },
  ]);
  assert.equal(summarize(r).slowest.length, 2);
});

test("expected failures are expected; unexpected passes remain unexpected", () => {
  assert.equal(
    summarize(outcome(report(), "expected", [attempt("failed")], "failed"))
      .counts.expected,
    1,
  );
  assert.equal(
    summarize(outcome(report(), "unexpected", [attempt("passed")], "failed"))
      .counts.unexpected,
    1,
  );
});

for (const [name, results, expectedStatus] of [
  ["declared skip", [attempt("skipped", 0)], "skipped"],
  ["runtime skip", [attempt("skipped", 0)], "passed"],
  ["not executed", [], "passed"],
  ["interrupted", [attempt("interrupted", 5)], "passed"],
]) {
  test(`${name} remains a blocking skipped outcome`, () => {
    const summary = summarize(
      outcome(report(), "skipped", results, expectedStatus),
    );
    assert.equal(summary.counts.skipped, 1);
    assert.equal(summary.counts.expected, 0);
    assert.equal(summary.slowest[0].attempts, results.length);
    if (name === "interrupted") assert.ok(summary.errors.length > 0);
  });
}

test("interruption cannot disappear behind an earlier expected attempt", () => {
  const summary = summarize(
    outcome(report(), "expected", [attempt(), attempt("interrupted", 5, 1)]),
  );
  assert.ok(summary.errors.some((error) => /interrupt/i.test(error)));
});

test("global report errors are counted without exposing payloads", () => {
  const r = report();
  r.errors = [
    {
      message: "PRIVATE_GLOBAL_MESSAGE",
      stack: "PRIVATE_STACK",
      value: "PRIVATE_VALUE",
    },
  ];
  const summary = summarize(r);
  assert.equal(summary.errors.length, 1);
  assert.doesNotMatch(JSON.stringify(summary), /PRIVATE_/);
});

const malformed = [
  ["missing report", () => undefined],
  ["nonobject report", () => []],
  [
    "missing suites",
    (r) => {
      delete r.suites;
    },
  ],
  [
    "malformed suite",
    (r) => {
      r.suites = [null];
    },
  ],
  [
    "missing specs",
    (r) => {
      delete r.suites[0].specs;
    },
  ],
  [
    "malformed nested suites",
    (r) => {
      r.suites[0].suites = {};
    },
  ],
  [
    "truncated nested suite",
    (r) => {
      r.suites[0].suites = [{}];
    },
  ],
  [
    "malformed spec",
    (r) => {
      r.suites[0].specs = [false];
    },
  ],
  [
    "missing tests",
    (r) => {
      delete specOf(r).tests;
    },
  ],
  [
    "zero tests in spec",
    (r) => {
      specOf(r).tests = [];
    },
  ],
  [
    "missing results",
    (r) => {
      delete testOf(r).results;
    },
  ],
  [
    "malformed result",
    (r) => {
      testOf(r).results = [null];
    },
  ],
  [
    "empty expected results",
    (r) => {
      testOf(r).results = [];
    },
  ],
  [
    "missing attempt status",
    (r) => {
      delete testOf(r).results[0].status;
    },
  ],
  [
    "unknown attempt status",
    (r) => {
      testOf(r).results[0].status = "success";
    },
  ],
  [
    "unknown outcome",
    (r) => {
      testOf(r).status = "passed";
    },
  ],
  [
    "unknown expected status",
    (r) => {
      testOf(r).expectedStatus = "success";
    },
  ],
  [
    "missing stats",
    (r) => {
      delete r.stats;
    },
  ],
  [
    "missing global errors",
    (r) => {
      delete r.errors;
    },
  ],
  [
    "malformed global errors",
    (r) => {
      r.errors = {};
    },
  ],
  [
    "malformed global error entry",
    (r) => {
      r.errors = [null];
    },
  ],
  [
    "missing file",
    (r) => {
      delete specOf(r).file;
    },
  ],
  [
    "empty title",
    (r) => {
      specOf(r).title = "";
    },
  ],
  [
    "missing suite title",
    (r) => {
      delete r.suites[0].title;
    },
  ],
  [
    "missing project identity",
    (r) => {
      delete testOf(r).projectId;
    },
  ],
  [
    "missing retry index",
    (r) => {
      delete testOf(r).results[0].retry;
    },
  ],
  [
    "retry gap",
    (r) => {
      testOf(r).results[0].retry = 1;
    },
  ],
  [
    "duplicate spec",
    (r) => {
      r.suites[0].specs.push(structuredClone(specOf(r)));
      r.stats.expected = 2;
    },
  ],
  [
    "zero report tests",
    (r) => {
      r.suites = [];
      r.stats.expected = 0;
    },
  ],
  [
    "missing stats count",
    (r) => {
      delete r.stats.flaky;
    },
  ],
  [
    "disagreed stats",
    (r) => {
      r.stats.expected = 2;
    },
  ],
  [
    "hidden extra stats outcome",
    (r) => {
      r.stats.unexpected = 1;
    },
  ],
  [
    "negative stats count",
    (r) => {
      r.stats.skipped = -1;
    },
  ],
  [
    "fractional stats count",
    (r) => {
      r.stats.expected = 1.5;
    },
  ],
  [
    "coerced stats count",
    (r) => {
      r.stats.expected = "1";
    },
  ],
  [
    "unsafe stats count",
    (r) => {
      r.stats.expected = Number.MAX_SAFE_INTEGER + 1;
    },
  ],
  [
    "false expected from failed attempt",
    (r) => {
      testOf(r).results[0].status = "failed";
    },
  ],
  [
    "retry pass hidden as expected",
    (r) => {
      testOf(r).results = [attempt("failed"), attempt("passed", 10, 1)];
    },
  ],
  [
    "skip hidden as expected",
    (r) => {
      testOf(r).results[0].status = "skipped";
    },
  ],
  [
    "unexpected hidden by ok",
    (r) => {
      outcome(r, "unexpected", [attempt("failed")]);
      specOf(r).ok = true;
    },
  ],
];
for (const [name, mutate] of malformed) {
  test(`rejects ${name} rather than returning success`, () => {
    let r = report();
    if (name === "missing report" || name === "nonobject report") r = mutate(r);
    else mutate(r);
    assert.equal(
      typeof api.summarizePlaywright,
      "function",
      "summarizePlaywright must be exported",
    );
    assert.throws(() => summarize(r), /invalid|incomplete/i);
  });
}
for (const value of [
  -1,
  NaN,
  Infinity,
  -Infinity,
  "20",
  null,
  undefined,
  Number.MAX_VALUE,
]) {
  for (const field of ["elapsed", "attempt"]) {
    test(`rejects ${field} duration ${String(value)}`, () => {
      const r = report();
      if (field === "elapsed") r.stats.duration = value;
      else testOf(r).results[0].duration = value;
      assert.equal(
        typeof api.summarizePlaywright,
        "function",
        "summarizePlaywright must be exported",
      );
      assert.throws(() => summarize(r), /invalid|duration/i);
    });
  }
}

test("zero durations remain valid", () => {
  const r = report();
  r.stats.duration = testOf(r).results[0].duration = 0;
  assert.equal(summarize(r).durationMs, 0);
  assert.equal(summarize(r).files[0].durationMs, 0);
});

test("rejects summed duration overflow across different files", () => {
  const r = report();
  testOf(r).results[0].duration = Number.MAX_SAFE_INTEGER;
  const second = structuredClone(r.suites[0]);
  second.file = second.specs[0].file = "tests/e2e/beta.spec.ts";
  second.specs[0].id = "spec-b";
  r.suites.push(second);
  r.stats.expected = 2;
  assert.throws(() => summarize(r), /invalid|incomplete/i);
});

test("all returned labels are single-line plain text and omit raw test artifacts", () => {
  const r = report();
  r.suites[0].file = specOf(r).file =
    "tests/\u001b[31malpha\u001b[0m\r\n.spec.ts";
  specOf(r).title =
    "load\u001b]8;;https://example.test\u0007link\u001b]8;;\u0007\u202e\n::error::spoof";
  Object.assign(testOf(r).results[0], {
    error: { message: "PRIVATE_ERROR", stack: "PRIVATE_STACK" },
    stdout: [{ text: "PRIVATE_STDOUT" }],
    stderr: [{ text: "PRIVATE_STDERR" }],
    attachments: [
      {
        name: "PRIVATE_ATTACHMENT",
        body: "PRIVATE_BODY",
        path: "PRIVATE_PATH",
        contentType: "text/plain",
      },
    ],
  });
  const summary = summarize(r);
  for (const label of [
    summary.files[0].file,
    summary.slowest[0].file,
    summary.slowest[0].title,
  ]) {
    assert.doesNotMatch(label, /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u);
  }
  assert.doesNotMatch(JSON.stringify(summary), /PRIVATE_|https:\/\/example/);
});

test("CLI prints readable elapsed and summed durations and returns zero for clean reports", (t) => {
  const result = runCli(t, report());
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /elapsed[^\n]*100\s*ms/i);
  assert.match(result.stdout, /summed[^\n]*20\s*ms/i);
  assert.match(result.stdout, /expected[^\n]*1/i);
  assert.match(result.stdout, /alpha\.spec\.ts/);
});
for (const [name, r] of [
  [
    "flaky",
    outcome(report(), "flaky", [attempt("failed"), attempt("passed", 10, 1)]),
  ],
  ["skipped", outcome(report(), "skipped", [attempt("skipped", 0)], "skipped")],
  ["unexecuted", outcome(report(), "skipped", [])],
  ["interrupted", outcome(report(), "skipped", [attempt("interrupted")])],
  ["unexpected", outcome(report(), "unexpected", [attempt("timedOut")])],
  [
    "global errors",
    {
      ...report(),
      errors: [{ message: "PRIVATE_GLOBAL", stack: "PRIVATE_STACK" }],
    },
  ],
]) {
  test(`CLI blocks ${name} reports with a readable summary`, (t) => {
    const result = runCli(t, r);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /elapsed/i);
    assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_/);
  });
}
for (const [name, content, args] of [
  ["missing report", undefined, undefined],
  ["invalid JSON", '{"PRIVATE_JSON_SECRET": broken}', undefined],
  ["invalid report tree", { ...report(), suites: ["PRIVATE_TREE"] }, undefined],
  ["no arguments", undefined, []],
  ["extra arguments", undefined, ["PRIVATE_PATH", "extra"]],
]) {
  test(`CLI rejects ${name} without raw inputs or parser/filesystem stacks`, (t) => {
    const result = runCli(t, content, args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /invalid|cannot|usage/i);
    assert.doesNotMatch(
      result.stderr,
      /PRIVATE_|SyntaxError|ENOENT|at file:|node:internal/,
    );
  });
}

test("CLI strips control characters from titles and paths", (t) => {
  const r = report();
  specOf(r).title = "safe\r\n::error::spoof\u001b[31m\u202e";
  r.suites[0].file = specOf(r).file = "a\u001b[2J.spec.ts";
  const result = runCli(t, r);
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /[\u001b\r\u202e]|\n::error::/);
});
