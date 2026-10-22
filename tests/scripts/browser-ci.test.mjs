import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const api =
  await import("../../.github/scripts/merge-browser-reports.mjs").catch(
    () => ({}),
  );
const revision = "a".repeat(40);
const identity = { revision, runId: "10", runAttempt: "1" };

function spec(id) {
  return {
    id,
    title: `case ${id}`,
    file: "example.spec.ts",
    line: id === "a" ? 1 : 2,
    column: 1,
    ok: true,
    tests: [
      {
        projectId: "chromium",
        projectName: "chromium",
        expectedStatus: "passed",
        status: "expected",
        results: [{ status: "passed", duration: 100, retry: 0 }],
      },
    ],
  };
}

function report(current, id) {
  return {
    config: {
      shard: { current, total: 2 },
      metadata: { ciRevision: revision, ciRun: "10", ciAttempt: "1" },
    },
    suites: [
      {
        title: "example",
        file: "example.spec.ts",
        line: 0,
        column: 0,
        specs: [spec(id)],
      },
    ],
    errors: [],
    stats: {
      startTime: "2026-10-21T15:00:00.000Z",
      duration: 110,
      expected: 1,
      unexpected: 0,
      flaky: 0,
      skipped: 0,
    },
  };
}

const inventory = {
  suites: [
    {
      title: "example",
      file: "example.spec.ts",
      specs: [spec("a"), spec("b")],
    },
  ],
  errors: [],
};

test("two successful shards cover the complete discovered suite exactly once", () => {
  assert.equal(typeof api.verifyShardReports, "function");
  const result = api.verifyShardReports(
    [report(1, "a"), report(2, "b")],
    inventory,
    identity,
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].counts.expected, 1);
  assert.equal(result[1].counts.expected, 1);
});

test("a missing, repeated or unexpected shard cannot satisfy the aggregate", () => {
  for (const reports of [
    [],
    [report(1, "a")],
    [report(1, "a"), report(1, "b")],
    [report(1, "a"), report(3, "b")],
  ]) {
    assert.throws(() => api.verifyShardReports(reports, inventory, identity));
  }
});

test("reports from a different revision, run or retry are rejected", () => {
  for (const key of ["ciRevision", "ciRun", "ciAttempt"]) {
    const stale = report(2, "b");
    stale.config.metadata[key] = "wrong";
    assert.throws(() =>
      api.verifyShardReports([report(1, "a"), stale], inventory, identity),
    );
  }
});

test("missing cases, duplicate cases and added undiscovered cases are rejected", () => {
  for (const id of ["a", "other"]) {
    assert.throws(() =>
      api.verifyShardReports(
        [report(1, "a"), report(2, id)],
        inventory,
        identity,
      ),
    );
  }
  const empty = structuredClone(inventory);
  empty.suites[0].specs = [];
  assert.throws(() =>
    api.verifyShardReports([report(1, "a"), report(2, "b")], empty, identity),
  );
});

test("flaky, skipped and unexpectedly failed mandatory tests block the aggregate", () => {
  for (const outcome of ["flaky", "skipped", "unexpected"]) {
    const bad = report(2, "b");
    bad.suites[0].specs[0].tests[0].status = outcome;
    bad.stats.expected = 0;
    bad.stats[outcome] = 1;
    bad.suites[0].specs[0].tests[0].results =
      outcome === "flaky"
        ? [
            { status: "failed", duration: 100, retry: 0 },
            { status: "passed", duration: 100, retry: 1 },
          ]
        : [
            {
              status: outcome === "skipped" ? "skipped" : "failed",
              duration: 1,
              retry: 0,
            },
          ];
    assert.throws(() =>
      api.verifyShardReports([report(1, "a"), bad], inventory, identity),
    );
  }
});

test("discovery errors and malformed evidence fail closed", () => {
  const errored = { ...inventory, errors: [{ message: "discovery failed" }] };
  assert.throws(() =>
    api.verifyShardReports([report(1, "a"), report(2, "b")], errored, identity),
  );
  for (const bad of [null, {}, { ...identity, revision: "" }]) {
    assert.throws(() =>
      api.verifyShardReports([report(1, "a"), report(2, "b")], inventory, bad),
    );
  }
});

test("the real Playwright CLI produces two compatible reports and mergeable blobs", (t) => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const scratch = join(root, ".superpowers");
  mkdirSync(scratch, { recursive: true });
  const fixture = mkdtempSync(join(scratch, "shard-contract-"));
  t.after(() => {
    if (!resolve(fixture).startsWith(resolve(scratch) + sep))
      throw new Error("Unsafe fixture cleanup");
    rmSync(fixture, { recursive: true, force: true });
  });
  const cli = join(root, "node_modules/@playwright/test/cli.js");
  const config = join(fixture, "playwright.config.mjs");
  writeFileSync(
    config,
    `export default ${JSON.stringify({ testDir: fixture, testMatch: "cases.spec.mjs", fullyParallel: true, workers: 1, projects: [{ name: "chromium" }], metadata: { ciRevision: revision, ciRun: "10", ciAttempt: "1" } })};`,
  );
  writeFileSync(
    join(fixture, "cases.spec.mjs"),
    'import { test, expect } from "@playwright/test";\ntest("first", () => expect(1).toBe(1));\ntest("second", () => expect(2).toBe(2));\n',
  );
  const env = {
    ...process.env,
    GITHUB_SHA: revision,
    GITHUB_RUN_ID: "10",
    GITHUB_RUN_ATTEMPT: "1",
  };
  delete env.FORCE_COLOR;
  delete env.NO_COLOR;
  const inventoryPath = join(fixture, "inventory.json");
  writeFileSync(
    inventoryPath,
    execFileSync(
      process.execPath,
      [cli, "test", "--config", config, "--list", "--reporter=json"],
      { cwd: root, env },
    ),
  );
  for (const index of [1, 2]) {
    const directory = join(fixture, `playwright-shard-10-1-${index}`);
    mkdirSync(join(directory, "reports"), { recursive: true });
    execFileSync(
      process.execPath,
      [
        cli,
        "test",
        "--config",
        config,
        `--shard=${index}/2`,
        "--fail-on-flaky-tests",
        "--reporter=json,blob",
      ],
      {
        cwd: root,
        env: {
          ...env,
          PLAYWRIGHT_JSON_OUTPUT_NAME: join(
            directory,
            "reports",
            `browser-${index}.json`,
          ),
          PLAYWRIGHT_BLOB_OUTPUT_DIR: join(directory, "blob-report"),
        },
      },
    );
  }
  const aggregate = join(root, ".github/scripts/merge-browser-reports.mjs");
  const result = spawnSync(
    process.execPath,
    [aggregate, fixture, inventoryPath],
    { cwd: root, env, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Both shards match/);
  assert.deepEqual(readdirSync(join(fixture, "verified-blobs")).sort(), [
    "shard-1.zip",
    "shard-2.zip",
  ]);
  const html = join(fixture, "html");
  execFileSync(
    process.execPath,
    [cli, "merge-reports", "--reporter=html", join(fixture, "verified-blobs")],
    {
      cwd: root,
      env: {
        ...env,
        PLAYWRIGHT_HTML_OUTPUT_DIR: html,
        PLAYWRIGHT_HTML_OPEN: "never",
      },
    },
  );
  assert.match(
    readFileSync(join(html, "index.html"), "utf8"),
    /<!DOCTYPE html>/i,
  );
  const repeat = spawnSync(
    process.execPath,
    [aggregate, fixture, inventoryPath],
    { cwd: root, env, encoding: "utf8" },
  );
  assert.equal(
    repeat.status,
    1,
    "stale blobs must not be reused by a second aggregate invocation",
  );
});
