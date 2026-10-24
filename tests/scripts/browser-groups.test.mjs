import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const script = join(root, ".github/scripts/plan-browser-groups.mjs");
const api = await import(pathToFileURL(script).href).catch(() => ({}));
const revision = "a".repeat(40);
const runs = ["39754274021", "39754407212", "39756641052"];
const provenance = { revision, runs: [{ id: "1", revision }] };
const timings = (samples) => ({ version: 1, samples, provenance });
const sample = (
  file,
  durationMs,
  titlePath = ["case"],
  projectId = "chromium",
) => ({ file: `tests/e2e/${file}`, titlePath, projectId, durationMs });
function spec(
  id,
  file = `${id}.spec.ts`,
  title = "case",
  projectId = "chromium",
) {
  return {
    id,
    file,
    title,
    tests: [{ projectId, projectName: projectId, results: [] }],
  };
}
function inventory(specs = [spec("a"), spec("b"), spec("c"), spec("d")]) {
  return {
    config: {
      fullyParallel: true,
      rootDir: "/repo/tests/e2e",
      configFile: "/repo/playwright.config.ts",
      projects: [
        { id: "chromium", name: "chromium", testDir: "/repo/tests/e2e" },
      ],
    },
    errors: [],
    suites: specs.map((entry) => ({
      title: entry.file,
      file: entry.file,
      specs: [entry],
    })),
  };
}
const measured = () =>
  timings([
    sample("a.spec.ts", 8),
    sample("b.spec.ts", 7),
    sample("c.spec.ts", 6),
    sample("d.spec.ts", 5),
  ]);
const ids = (groups) =>
  groups.flatMap((group) => group.tests.map((entry) => entry.id)).sort();

test("LPT balances measured files with complete merge-compatible identities", () => {
  assert.equal(typeof api.planBrowserGroups, "function");
  const groups = api.planBrowserGroups(inventory(), measured());
  assert.deepEqual(groups, [
    {
      index: 1,
      estimatedMs: 13,
      tests: [
        {
          id: '["a","chromium"]',
          selector: "[chromium] › a.spec.ts › case",
          estimatedMs: 8,
        },
        {
          id: '["d","chromium"]',
          selector: "[chromium] › d.spec.ts › case",
          estimatedMs: 5,
        },
      ],
    },
    {
      index: 2,
      estimatedMs: 13,
      tests: [
        {
          id: '["b","chromium"]',
          selector: "[chromium] › b.spec.ts › case",
          estimatedMs: 7,
        },
        {
          id: '["c","chromium"]',
          selector: "[chromium] › c.spec.ts › case",
          estimatedMs: 6,
        },
      ],
    },
  ]);
});

test("new and renamed cases use a positive rounded-up median and stale timings are harmless", () => {
  const value = inventory([
    spec("a"),
    spec("new"),
    spec("renamed", "b.spec.ts", "renamed"),
  ]);
  const result = api.planBrowserGroups(value, measured());
  assert.deepEqual(ids(result), [
    '["a","chromium"]',
    '["new","chromium"]',
    '["renamed","chromium"]',
  ]);
  for (const entry of result.flatMap((group) => group.tests))
    assert.equal(entry.estimatedMs, entry.id === '["a","chromium"]' ? 8 : 7);
});

test("ties and permutations produce identical output across portable root paths", () => {
  const value = inventory([spec("z"), spec("A"), spec("ä"), spec("Z")]);
  const times = timings([sample("stale.spec.ts", 10)]);
  const expected = api.planBrowserGroups(value, times);
  assert.deepEqual(
    expected[0].tests.map((entry) => entry.id),
    ['["A","chromium"]', '["z","chromium"]'],
  );
  value.suites.reverse();
  value.config.configFile = "C:\\repo\\playwright.config.ts";
  value.config.rootDir = "C:/repo/tests/e2e";
  value.config.projects[0].testDir = value.config.rootDir;
  assert.deepEqual(api.planBrowserGroups(value, times), expected);
  const original = structuredClone(value);
  const originalTimings = structuredClone(times);
  api.planBrowserGroups(value, times);
  assert.deepEqual(value, original);
  assert.deepEqual(times, originalTimings);
});

test("selectors include project display name and the full nested describe chain", () => {
  const value = inventory([spec("a"), spec("b")]);
  value.config.projects[0].name = "Desktop Chrome";
  value.suites[0].specs = [];
  value.suites[0].suites = [
    {
      title: "outer",
      file: "a.spec.ts",
      specs: [],
      suites: [
        {
          title: "inner",
          file: "a.spec.ts",
          specs: [spec("a", "a.spec.ts", "title")],
        },
      ],
    },
  ];
  for (const suite of value.suites) {
    const visit = (s) => {
      for (const entry of s.specs)
        entry.tests[0].projectName = "Desktop Chrome";
      for (const child of s.suites ?? []) visit(child);
    };
    visit(suite);
  }
  const groups = api.planBrowserGroups(
    value,
    timings([
      sample("a.spec.ts", 50, ["outer", "inner", "title"]),
      sample("b.spec.ts", 1),
    ]),
  );
  assert.equal(
    groups[0].tests[0].selector,
    "[Desktop Chrome] › a.spec.ts › outer › inner › title",
  );
  assert.equal(groups[0].tests[0].estimatedMs, 50);
});

test("every file except the explicit independent veil allowlist stays atomic", () => {
  const value = inventory([
    spec("a"),
    spec("b"),
    spec("c", "a.spec.ts", "second"),
  ]);
  const groups = api.planBrowserGroups(value, measured());
  const groupA = groups.find((group) =>
    group.tests.some((entry) => entry.id === '["a","chromium"]'),
  );
  assert.ok(groupA.tests.some((entry) => entry.id === '["c","chromium"]'));
  assert.deepEqual(ids(groups), [
    '["a","chromium"]',
    '["b","chromium"]',
    '["c","chromium"]',
  ]);
});

test("malformed timing schemas, duplicates, paths and nonpositive/nonfinite durations fail closed", () => {
  const bad = [
    null,
    {},
    { ...measured(), version: 2 },
    timings([]),
    { ...measured(), provenance: {} },
  ];
  for (const duration of [0, -1, NaN, Infinity, "10", null])
    bad.push(timings([sample("a.spec.ts", duration)]));
  bad.push(timings([sample("a.spec.ts", 1), sample("a.spec.ts", 2)]));
  for (const file of [
    "../a.spec.ts",
    "/a.spec.ts",
    "tests\\e2e\\a.spec.ts",
    "tests//a.spec.ts",
    "C:/a.spec.ts",
    "tests/a:1.spec.ts",
    "tests/./a.spec.ts",
  ])
    bad.push(timings([{ ...sample("a.spec.ts", 1), file }]));
  for (const titlePath of [
    [],
    [""],
    [" bad"],
    ["bad\nsecret"],
    ["a › b"],
    ["a > b"],
    [null],
  ])
    bad.push(timings([sample("a.spec.ts", 1, titlePath)]));
  for (const value of bad)
    assert.throws(
      () => api.planBrowserGroups(inventory(), value),
      /Invalid or ambiguous browser planning input/,
    );
});

test("malformed discovery, unsafe selectors, ambiguous prefixes and duplicate identities fail closed", () => {
  const cases = [
    null,
    {},
    { ...inventory(), errors: [{}] },
    inventory([]),
    inventory([spec("only")]),
  ];
  for (const fullyParallel of [false, undefined, "true"]) {
    const value = inventory();
    value.config.fullyParallel = fullyParallel;
    cases.push(value);
  }
  cases.push(inventory([spec("same"), spec("same")]));
  cases.push(inventory([spec("a"), spec("b", "a.spec.ts")]));
  for (const title of [
    "",
    "bad\rsecret",
    "bad\u001b[31m",
    "bad\u2028title",
    "a > b",
    "a › b",
    "case ",
  ]) {
    const value = inventory();
    value.suites[0].specs[0].title = title;
    cases.push(value);
  }
  for (const file of [
    "../a.spec.ts",
    "/a.spec.ts",
    "a\\b.spec.ts",
    "a:1:2.spec.ts",
    "a//b.spec.ts",
    "a/./b.spec.ts",
  ]) {
    const value = inventory();
    value.suites[0].file = file;
    value.suites[0].title = file;
    value.suites[0].specs[0].file = file;
    cases.push(value);
  }
  const prefix = inventory([spec("a"), spec("b")]);
  prefix.suites[0].suites = [
    {
      title: "case",
      file: "a.spec.ts",
      specs: [spec("child", "a.spec.ts", "child")],
    },
  ];
  cases.push(prefix);
  const project = inventory();
  project.config.projects[0].name = "bad]";
  cases.push(project);
  const unknown = inventory();
  unknown.suites[0].specs[0].tests[0].projectId = "unknown";
  cases.push(unknown);
  const mismatch = inventory();
  mismatch.suites[0].specs[0].file = "wrong.spec.ts";
  cases.push(mismatch);
  const escape = inventory();
  escape.config.rootDir = "/elsewhere";
  cases.push(escape);
  const singleFile = inventory([spec("a"), spec("b", "a.spec.ts", "second")]);
  cases.push(singleFile);
  for (const value of cases)
    assert.throws(() => api.planBrowserGroups(value, measured()));
});

function scratch(t) {
  const directory = mkdtempSync(join(tmpdir(), "browser-groups-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function cli(args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}
function discover(extra = []) {
  const env = { ...process.env };
  for (const key of [
    "PLAYWRIGHT_JSON_OUTPUT_NAME",
    "PLAYWRIGHT_JSON_OUTPUT_FILE",
    "FORCE_COLOR",
    "NO_COLOR",
  ])
    delete env[key];
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        join(root, "node_modules/@playwright/test/cli.js"),
        "test",
        "--list",
        "--reporter=json",
        ...extra,
      ],
      { cwd: root, env, encoding: "utf8", maxBuffer: 5_000_000 },
    ),
  );
}
function discoveredCases(report) {
  const result = [];
  function visit(suite, parents = []) {
    for (const entry of suite.specs)
      for (const project of entry.tests)
        result.push({
          id: JSON.stringify([entry.id, project.projectId]),
          file: `tests/e2e/${entry.file}`,
          titlePath: [...parents, entry.title],
          projectId: project.projectId,
          test: project,
        });
    for (const child of suite.suites ?? [])
      visit(child, [...parents, child.title]);
  }
  for (const suite of report.suites) visit(suite);
  return result;
}

test("the only split file explicitly stays parallel without serial suites or shared lifecycle hooks", () => {
  const source = readFileSync(join(root, "tests/e2e/veil.spec.ts"), "utf8");
  assert.match(
    source,
    /test\.describe\.configure\(\{\s*mode:\s*["']parallel["']\s*\}\)/,
  );
  assert.doesNotMatch(source, /\bserial\b|\b(?:beforeAll|afterAll)\b/);
});

test("portable baseline records 63 measured cases and the three exact source runs", () => {
  const baseline = JSON.parse(
    readFileSync(join(root, ".github/browser-timings.json"), "utf8"),
  );
  assert.equal(baseline.version, 1);
  assert.equal(
    baseline.provenance.revision,
    "847e7f893a28eef5b26eabf4a546263f6742375f",
  );
  assert.deepEqual(
    baseline.provenance.runs,
    runs.map((id, index) => ({
      id,
      revision:
        index === 0
          ? "99f2e941c9e76914ce33c19594a81e03b06ea25f"
          : baseline.provenance.revision,
    })),
  );
  assert.equal(baseline.samples.length, 63);
  for (const entry of baseline.samples) {
    assert.deepEqual(Object.keys(entry).sort(), [
      "durationMs",
      "file",
      "projectId",
      "titlePath",
    ]);
    assert.match(entry.file, /^tests\/e2e\//);
  }
  // Stored first-attempt observations: 2138, 1705, 2132 ms. The full local
  // 63-case derivation was audited against artifacts before this baseline shipped.
  const first = baseline.samples.find(
    (entry) =>
      entry.titlePath[0] ===
      "static technology marquees can be scrolled with the keyboard",
  );
  assert.equal(first.durationMs, 2132);
});

test("CLI creates fresh lists that the installed Playwright selects exactly, disjointly and completely", (t) => {
  const directory = scratch(t);
  const full = discover();
  const fullCases = discoveredCases(full);
  const inventoryPath = join(directory, "inventory.json");
  writeFileSync(inventoryPath, JSON.stringify(full));
  const output = join(directory, "groups");
  const result = cli([
    inventoryPath,
    join(root, ".github/browser-timings.json"),
    output,
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readdirSync(output).sort(), [
    "group-1.txt",
    "group-2.txt",
    "plan.json",
  ]);
  const plan = JSON.parse(readFileSync(join(output, "plan.json"), "utf8"));
  assert.equal(plan.version, 1);
  assert.match(plan.caveats.join(" "), /veil.*independen/i);
  const selected = [];
  for (const group of plan.groups) {
    const list = join(output, `group-${group.index}.txt`);
    assert.equal(
      readFileSync(list, "utf8"),
      group.tests.map((entry) => entry.selector).join("\n") + "\n",
    );
    const cases = discoveredCases(discover(["--test-list", list]));
    assert.deepEqual(
      cases.map((entry) => entry.id).sort(),
      group.tests.map((entry) => entry.id).sort(),
    );
    assert.ok(cases.some((entry) => entry.file.endsWith("/veil.spec.ts")));
    selected.push(...cases);
  }
  assert.equal(
    new Set(selected.map((entry) => entry.id)).size,
    fullCases.length,
  );
  assert.deepEqual(
    selected.map((entry) => entry.id).sort(),
    fullCases.map((entry) => entry.id).sort(),
  );
  assert.equal(
    fullCases.filter((entry) => entry.file.endsWith("/veil.spec.ts")).length,
    6,
  );
  for (const file of new Set(
    fullCases
      .map((entry) => entry.file)
      .filter((file) => !file.endsWith("/veil.spec.ts")),
  )) {
    const fileIds = new Set(
      fullCases.filter((entry) => entry.file === file).map((entry) => entry.id),
    );
    assert.equal(
      plan.groups.filter((group) =>
        group.tests.some((entry) => fileIds.has(entry.id)),
      ).length,
      1,
      file,
    );
  }
  const durations = new Map(
    plan.groups.flatMap((group) =>
      group.tests.map((entry) => [entry.id, entry.estimatedMs]),
    ),
  );
  const countLoads = [1, 2].map((index) =>
    discoveredCases(discover([`--shard=${index}/2`])).reduce(
      (sum, entry) => sum + durations.get(entry.id),
      0,
    ),
  );
  assert.ok(
    Math.max(...plan.groups.map((group) => group.estimatedMs)) <
      Math.max(...countLoads),
  );
  console.log(
    JSON.stringify({
      predictedGroups: plan.groups.map(({ index, estimatedMs, tests }) => ({
        index,
        estimatedMs,
        tests: tests.length,
        veil: tests.filter((entry) => entry.selector.includes("veil.spec.ts"))
          .length,
      })),
      countLoads,
    }),
  );
  assert.equal(
    cli([inventoryPath, join(root, ".github/browser-timings.json"), output])
      .status,
    1,
  );
});

test("CLI rejects invalid input quietly before creating output or replacing existing files", (t) => {
  const directory = scratch(t);
  const bad = join(directory, "bad.json");
  const times = join(directory, "timings.json");
  writeFileSync(bad, '{"secret":"PRIVATE_CONTENT"');
  writeFileSync(times, JSON.stringify(measured()));
  for (const args of [
    [],
    [bad, times, join(directory, "groups")],
    [join(directory, "missing"), times, join(directory, "missing-groups")],
  ]) {
    const result = cli(args);
    assert.equal(result.status, 1);
    assert.doesNotMatch(
      result.stderr,
      /PRIVATE_CONTENT|SyntaxError|ENOENT|at file:/,
    );
  }
  assert.deepEqual(readdirSync(directory).sort(), ["bad.json", "timings.json"]);
});
