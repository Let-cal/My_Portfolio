import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

const outcomes = ["expected", "unexpected", "flaky", "skipped"];
const statuses = ["passed", "failed", "timedOut", "skipped", "interrupted"];
const invalid = () => {
  // Never interpolate report data into diagnostics: reports may contain secrets.
  throw new Error("Invalid or incomplete Playwright report");
};
const object = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
};
const array = (value) => {
  if (!Array.isArray(value)) invalid();
};
const text = (value, allowEmpty = false) => {
  if (typeof value !== "string" || (!allowEmpty && !plain(value))) invalid();
};
const integer = (value) => {
  if (!Number.isSafeInteger(value) || value < 0) invalid();
};
const duration = (value) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  )
    invalid();
  return value;
};
const plain = (value) =>
  stripVTControlCharacters(value)
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ")
    .trim();
const addDuration = (a, b) => duration(a + b);

// JSONReport, JSONReportSuite/Spec/Test/Result in playwright/types/testReporter.d.ts.
// Outcome rules mirror installed Playwright's computeTestCaseOutcome; interruption
// is also surfaced separately because that classifier can call it "skipped", or
// even "expected" when another attempt matched expectedStatus.
export function summarizePlaywright(report) {
  object(report);
  array(report.suites);
  array(report.errors);
  object(report.stats);
  const durationMs = duration(report.stats.duration);
  text(report.stats.startTime);
  if (
    !/^\d{4}-\d\d-\d\dT/.test(report.stats.startTime) ||
    !Number.isFinite(Date.parse(report.stats.startTime))
  )
    invalid();
  for (const key of outcomes) integer(report.stats[key]);
  const counts = { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
  const errors = report.errors.map((error, index) => {
    object(error);
    return `Report error ${index + 1} (details omitted)`;
  });
  const files = new Map();
  const slowest = [];
  const nodes = new WeakSet();
  const specs = new Set();
  const locations = new Set();
  let summedDuration = 0;

  function visit(suite, parents = [], parentFile) {
    object(suite);
    if (nodes.has(suite)) invalid();
    nodes.add(suite);
    text(suite.title, true);
    text(suite.file);
    integer(suite.line);
    integer(suite.column);
    array(suite.specs);
    if (parentFile !== undefined && suite.file !== parentFile) invalid();
    const titles =
      parentFile === undefined ? parents : [...parents, suite.title];
    for (const spec of suite.specs) {
      object(spec);
      text(spec.id);
      text(spec.title);
      text(spec.file);
      integer(spec.line);
      integer(spec.column);
      if (spec.file !== suite.file || typeof spec.ok !== "boolean") invalid();
      array(spec.tests);
      if (!spec.tests.length) invalid();
      const location = JSON.stringify([
        spec.file,
        spec.line,
        spec.column,
        ...titles,
        spec.title,
      ]);
      if (specs.has(spec.id) || locations.has(location)) invalid();
      specs.add(spec.id);
      locations.add(location);
      for (const test of spec.tests) {
        object(test);
        text(test.projectId, true);
        text(test.projectName, true);
        if (
          !statuses.includes(test.expectedStatus) ||
          !outcomes.includes(test.status)
        )
          invalid();
        array(test.results);
        let testDuration = 0;
        let expected = 0;
        let unexpected = 0;
        let skipped = 0;
        let interrupted = false;
        let didNotRun = false;
        for (const [index, result] of test.results.entries()) {
          object(result);
          if (!statuses.includes(result.status) || result.retry !== index)
            invalid();
          testDuration = addDuration(testDuration, duration(result.duration));
          if (result.status === "interrupted") interrupted = true;
          else if (result.status === "skipped") {
            if (test.expectedStatus === "skipped") skipped++;
            else didNotRun = true;
          } else if (result.status === test.expectedStatus) expected++;
          else unexpected++;
        }
        const outcome =
          expected === 0 && unexpected === 0
            ? "skipped"
            : unexpected === 0
              ? "expected"
              : expected === 0 && skipped === 0
                ? "unexpected"
                : "flaky";
        if (test.status !== outcome) invalid();
        if (interrupted)
          errors.push("Interrupted test attempt (details omitted)");
        if (didNotRun && outcome === "expected")
          errors.push("Unexecuted test attempt (details omitted)");
        if (test.results.length > 1 && outcome === "expected")
          errors.push(
            "Repeated expected attempts require review (details omitted)",
          );
        counts[outcome]++;
        summedDuration = addDuration(summedDuration, testDuration);
        const file = files.get(spec.file) ?? {
          file: plain(spec.file),
          durationMs: 0,
          tests: 0,
        };
        file.durationMs = addDuration(file.durationMs, testDuration);
        file.tests++;
        files.set(spec.file, file);
        slowest.push({
          file: plain(spec.file),
          title: plain([...titles, spec.title].join(" › ")),
          outcome,
          durationMs: testDuration,
          attempts: test.results.length,
        });
      }
      // The JSON reporter keeps the FIRST project's ok flag when merging specs.
      if (spec.ok !== (spec.tests[0].status !== "unexpected")) invalid();
    }
    if (suite.suites !== undefined) {
      array(suite.suites);
      for (const child of suite.suites) visit(child, titles, suite.file);
    }
  }
  for (const suite of report.suites) visit(suite);
  if (
    !slowest.length ||
    outcomes.some((key) => counts[key] !== report.stats[key])
  )
    invalid();
  return {
    durationMs,
    counts,
    files: [...files.values()].sort(
      (a, b) => b.durationMs - a.durationMs || a.file.localeCompare(b.file),
    ),
    slowest: slowest.sort(
      (a, b) =>
        b.durationMs - a.durationMs ||
        a.file.localeCompare(b.file) ||
        a.title.localeCompare(b.title),
    ),
    errors,
  };
}

function main(args) {
  if (args.length !== 1) {
    console.error("Usage: node playwright-summary.mjs <report.json>");
    return 1;
  }
  let summary;
  try {
    summary = summarizePlaywright(JSON.parse(readFileSync(args[0], "utf8")));
  } catch {
    console.error(
      "Cannot summarize invalid, incomplete, or unreadable Playwright report.",
    );
    return 1;
  }
  // Every untrusted label follows a fixed prefix and is single-line plain text.
  console.log(`Elapsed report duration: ${summary.durationMs} ms`);
  console.log(
    `Summed test attempt time: ${summary.files.reduce((total, file) => addDuration(total, file.durationMs), 0)} ms`,
  );
  console.log(
    `Tests: ${outcomes.map((key) => `${key}=${summary.counts[key]}`).join(", ")}`,
  );
  console.log("Files (summed attempt time):");
  for (const file of summary.files)
    console.log(
      `  File: ${file.file} | ${file.durationMs} ms | ${file.tests} tests`,
    );
  console.log("Slowest tests (summed attempt time):");
  for (const entry of summary.slowest)
    console.log(
      `  Test: ${entry.file} | ${entry.title} | ${entry.outcome} | ${entry.durationMs} ms | ${entry.attempts} attempts`,
    );
  for (const error of summary.errors) console.log(`  Error: ${error}`);
  return summary.errors.length ||
    summary.counts.unexpected ||
    summary.counts.flaky ||
    summary.counts.skipped
    ? 1
    : 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = main(process.argv.slice(2));
}
