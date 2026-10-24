import { writeFileSync } from "node:fs";
import {
  adminScenarioFile,
  adminScenarioProject,
  adminScenarios,
} from "./admin-scenarios.mjs";

const scenarioIds = adminScenarios.map(({ id }) => id);
const outcomes = [
  "passed",
  "failed",
  "timedOut",
  "skipped",
  "interrupted",
  "missing",
  "invalid",
];
const categories = [
  "browser-launch",
  "browser-context",
  "navigation",
  "assertion",
  "settings",
  "other",
];

function validSource(value) {
  return (
    typeof value === "string" &&
    /^(?:admin-flows\.spec|fixtures|settings)\.ts:[1-9][0-9]{0,5}:[1-9][0-9]{0,4}$/.exec(
      value,
    )?.[0] === value
  );
}

function diagnostic(id, records) {
  const matches = records.filter((record) => scenarioId(record) === id);
  const record = matches.length === 1 ? matches[0] : undefined;
  const outcome = !matches.length
    ? "missing"
    : record?.retry === 0 && outcomes.includes(record.status)
      ? record.status
      : "invalid";
  return {
    id,
    outcome,
    ...(outcome !== "passed"
      ? {
          ...(validSource(record?.source) ? { source: record.source } : {}),
          category: categories.includes(record?.category)
            ? record.category
            : "other",
        }
      : {}),
  };
}

function projectDiagnostics(source) {
  if (
    !Array.isArray(source.diagnostics) ||
    !exactIds(source.diagnostics.map((entry) => entry?.id)) ||
    source.diagnostics.filter((entry) => entry?.outcome === "passed").length !==
      source.passed
  )
    throw new Error("Invalid admin browser diagnostics");
  return scenarioIds.map((id) => {
    const entry = source.diagnostics.find((entry) => entry.id === id);
    if (
      !outcomes.includes(entry.outcome) ||
      (entry.source !== undefined && !validSource(entry.source)) ||
      (entry.outcome === "passed"
        ? entry.category !== undefined || entry.source !== undefined
        : !categories.includes(entry.category))
    )
      throw new Error("Invalid admin browser diagnostics");
    return {
      id,
      outcome: entry.outcome,
      ...(entry.source !== undefined ? { source: entry.source } : {}),
      ...(entry.category !== undefined ? { category: entry.category } : {}),
    };
  });
}

function validMeta(meta) {
  return (
    typeof meta?.revision === "string" &&
    /^[a-f0-9]{40}$/.test(meta.revision) &&
    typeof meta.runId === "string" &&
    /^[1-9][0-9]*$/.test(meta.runId) &&
    typeof meta.attempt === "string" &&
    /^[1-9][0-9]*$/.test(meta.attempt)
  );
}

function scenarioId(record) {
  if (
    record?.file !== adminScenarioFile ||
    record.project !== adminScenarioProject ||
    typeof record.testId !== "string" ||
    !record.testId ||
    record.expectedStatus !== "passed"
  )
    return undefined;
  return adminScenarios.find(({ title }) => title === record.title)?.id;
}

function exactIds(ids) {
  return (
    Array.isArray(ids) &&
    ids.length === scenarioIds.length &&
    new Set(ids).size === scenarioIds.length &&
    scenarioIds.every((id) => ids.includes(id))
  );
}

export function adminSummary(records, expected, status, meta, discovered = []) {
  const valid = validMeta(meta);
  const selected = discovered.map(scenarioId).filter(Boolean);
  const discoveryValid =
    expected === discovered.length &&
    discovered.length === scenarioIds.length &&
    exactIds(selected) &&
    new Set(discovered.map((r) => r.testId)).size === scenarioIds.length;
  const executions = Object.fromEntries(scenarioIds.map((id) => [id, 0]));
  const seen = new Set();
  let executionsValid = discoveryValid;
  for (const record of records) {
    const id = scenarioId(record);
    const original = discovered.find((r) => r.testId === record.testId);
    const matches = id && original && scenarioId(original) === id;
    if (!matches || seen.has(record.testId)) executionsValid = false;
    if (id) executions[id]++;
    seen.add(record.testId);
  }
  const passed = records.filter(
    (r) =>
      r.status === "passed" && r.expectedStatus === "passed" && r.retry === 0,
  ).length;
  return {
    version: 1,
    status:
      valid &&
      status === "passed" &&
      discoveryValid &&
      executionsValid &&
      records.length === scenarioIds.length &&
      scenarioIds.every((id) => executions[id] === 1) &&
      passed === scenarioIds.length
        ? "PASS"
        : "FAIL",
    expected,
    attempts: records.length,
    passed,
    rejected: records.length - passed,
    selected: scenarioIds.filter((id) => selected.includes(id)),
    executions,
    diagnostics: scenarioIds.map((id) => diagnostic(id, records)),
    revision: valid ? meta.revision : null,
    runId: valid ? meta.runId : null,
    runAttempt: valid ? meta.attempt : null,
  };
}

export function projectAdminSummary(source, meta) {
  if (
    !source ||
    !validMeta(meta) ||
    source.version !== 1 ||
    !["PASS", "FAIL"].includes(source.status) ||
    source.revision !== meta.revision ||
    source.runId !== meta.runId ||
    source.runAttempt !== meta.attempt
  )
    throw new Error("Admin browser report identity mismatch");
  if (
    !exactIds(source.selected) ||
    !source.executions ||
    Array.isArray(source.executions) ||
    !exactIds(Object.keys(source.executions)) ||
    !scenarioIds.every((id) => source.executions[id] === 1)
  )
    throw new Error("Invalid mandatory admin browser identities");
  for (const key of ["expected", "attempts", "passed", "rejected"])
    if (
      !Number.isSafeInteger(source[key]) ||
      source[key] < 0 ||
      source[key] > 1000
    )
      throw new Error("Invalid admin browser counts");
  if (
    source.expected !== scenarioIds.length ||
    source.attempts !== scenarioIds.length ||
    source.passed + source.rejected !== source.attempts ||
    (source.status === "PASS" &&
      (source.passed !== scenarioIds.length || source.rejected !== 0))
  )
    throw new Error("Incomplete mandatory admin browser evidence");
  return {
    version: 1,
    status: source.status,
    expected: source.expected,
    attempts: source.attempts,
    passed: source.passed,
    rejected: source.rejected,
    selected: [...scenarioIds],
    executions: Object.fromEntries(scenarioIds.map((id) => [id, 1])),
    diagnostics: projectDiagnostics(source),
    revision: meta.revision,
    runId: meta.runId,
    runAttempt: meta.attempt,
  };
}

export default class AdminReporter {
  records = [];
  expected = 0;
  discovered = [];
  errored = false;
  onBegin(_config, suite) {
    this.discovered = suite.allTests().map(testIdentity);
    this.expected = this.discovered.length;
  }
  onTestEnd(test, result) {
    const annotations = Array.isArray(result.annotations)
      ? result.annotations
      : [];
    const source = annotations.find(
      (annotation) =>
        annotation?.type === "task4-source" &&
        validSource(annotation.description),
    )?.description;
    const category = annotations.find(
      (annotation) =>
        annotation?.type === "task4-category" &&
        categories.includes(annotation.description),
    )?.description;
    this.records.push({
      ...testIdentity(test),
      status: result.status,
      retry: result.retry,
      expectedStatus: test.expectedStatus,
      ...(source !== undefined ? { source } : {}),
      ...(category !== undefined ? { category } : {}),
    });
  }
  onError() {
    this.errored = true;
  }
  onEnd(result) {
    const summary = adminSummary(
      this.records,
      this.expected,
      this.errored ? "failed" : result.status,
      {
        revision: process.env.TASK4_REVISION,
        runId: process.env.TASK4_RUN_ID,
        attempt: process.env.TASK4_RUN_ATTEMPT,
      },
      this.discovered,
    );
    writeFileSync(process.env.TASK4_BROWSER_SUMMARY, JSON.stringify(summary), {
      mode: 0o600,
    });
    if (summary.status !== "PASS") return { status: "failed" };
  }
}

function testIdentity(test) {
  return {
    testId: test.id,
    title: test.title,
    file: test.location?.file,
    project: test.parent?.project()?.name,
    expectedStatus: test.expectedStatus,
  };
}
